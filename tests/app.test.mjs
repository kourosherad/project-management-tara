import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(path.join(os.tmpdir(), 'tara-test-'));
process.env.SQLITE_FILE = path.join(dir, 'test.db');
process.env.UPLOAD_DIR = path.join(dir, 'uploads');
process.env.TARA_DEMO = 'true';
process.env.VERCEL = '1';
process.env.JWT_SECRET = 'test-signing-key-with-at-least-32-characters';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.CLAUDE_ENABLED = 'false';
const { default: app } = await import('../app.js');
let server, base, token, projectId, taskId;
async function request(url, { method = 'GET', body, auth = token } = {}) {
  const headers = auth ? { Authorization: `Bearer ${auth}` } : {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + url, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { res, data };
}
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });

test('concurrent cold requests initialize once; health exposes disposable storage', async () => {
  const results = await Promise.all(Array.from({ length: 5 }, () => request('/api/health')));
  for (const { res, data } of results) {
    assert.equal(res.status, 200); assert.equal(data.demo, true);
    assert.equal(data.maxUploadBytes, 3 * 1024 * 1024);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  }
  assert.equal((await request('/api/projects')).res.status, 401);
});
test('login rejects wrong credentials and sets a secure session cookie', async () => {
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrong' } })).res.status, 401);
  const { res, data } = await request('/api/auth/login', { method: 'POST', body: { username: 'admin', password: process.env.ADMIN_PASSWORD } });
  assert.equal(res.status, 200); token = data.token;
  assert.match(res.headers.get('set-cookie'), /HttpOnly/);
  assert.match(res.headers.get('set-cookie'), /Secure/);
  const cookie = res.headers.get('set-cookie').split(';')[0];
  const me = await fetch(base + '/api/auth/me', { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  assert.equal((await request('/api/auth/users')).data.length, 1);
});
test('projects and task status changes compute progress and survive app re-import', async () => {
  const created = await request('/api/projects', { method: 'POST', body: { name: 'Tara test release', status: 'active' } });
  assert.equal(created.res.status, 201); projectId = created.data.id;
  const task = { title: '[P1] Verify login', responsible_team: 'Kourosh', phase: 'testing', end_date: '2026-09-10' };
  const createdTask = await request(`/api/tasks/project/${projectId}`, { method: 'POST', body: task });
  assert.equal(createdTask.res.status, 201); taskId = createdTask.data.id;
  assert.equal((await request(`/api/projects/${projectId}`)).data.progress, 0);
  assert.equal((await request(`/api/tasks/${taskId}`, { method: 'PUT', body: { ...task, status: 'done' } })).data.progress, 100);
  // A fresh process opens the same SQLite file without reseeding or losing changes.
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', "const {q,ensureReady}=await import('./server/db.js');await ensureReady();console.log(JSON.stringify(await q('SELECT progress FROM projects')));"], { cwd: path.resolve('.'), env: process.env, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /"progress":100/);
});
test('team, quality, user creation and admin permissions work', async () => {
  assert.equal((await request(`/api/members/project/${projectId}`, { method: 'POST', body: { name: 'Sample Friend', role: 'Reviewer' } })).res.status, 201);
  assert.equal((await request(`/api/quality/project/${projectId}`, { method: 'POST', body: { standard: 'Login works', status: 'passed' } })).res.status, 201);
  const user = { username: 'friend', full_name: 'Sample Friend', password: 'friend-test-password' };
  assert.equal((await request('/api/auth/users', { method: 'POST', body: user })).res.status, 201);
  assert.equal((await request('/api/auth/users', { method: 'POST', body: user })).res.status, 409);
  const login = await request('/api/auth/login', { method: 'POST', body: user });
  assert.equal((await request('/api/auth/users', { auth: login.data.token })).res.status, 403);
  assert.equal((await request('/api/projects', { auth: login.data.token })).res.status, 200);
});
test('document upload, authenticated download, deletion and size limit work', async () => {
  const fd = new FormData(); fd.set('category', 'spec'); fd.set('file', new Blob(['Sample specification']), 'spec.txt');
  const uploaded = await request(`/api/documents/project/${projectId}`, { method: 'POST', body: fd });
  assert.equal(uploaded.res.status, 201);
  const url = `/api/documents/${uploaded.data.id}/download`;
  assert.equal((await request(url, { auth: null })).res.status, 401);
  assert.equal((await request(url)).data, 'Sample specification');
  assert.equal((await request(`/api/documents/${uploaded.data.id}`, { method: 'DELETE' })).res.status, 200);
  assert.equal((await request(url)).res.status, 404);
  const large = new FormData(); large.set('file', new Blob([new Uint8Array(3 * 1024 * 1024 + 1)]), 'large.bin');
  assert.equal((await request(`/api/documents/project/${projectId}`, { method: 'POST', body: large })).res.status, 413);
});
test('disabled AI and invalid requests return JSON without crashing', async () => {
  assert.equal((await request('/api/ai/status')).data.available, false);
  assert.equal((await request(`/api/ai/project/${projectId}/ask`, { method: 'POST', body: { question: 'test' } })).res.status, 503);
  assert.equal((await request('/api/not-a-route')).res.status, 404);
  assert.equal((await request('/api/tasks/999999', { method: 'PUT', body: { title: 'missing' } })).res.status, 404);
  const failure = await request('/api/tasks/project/999999', { method: 'POST', body: { title: 'invalid parent' } });
  assert.equal(failure.res.status, 500); assert.equal(failure.data.error, 'Server error. Please try again.');
  assert.equal((await request('/api/health')).res.status, 200);
});
test('deleting tasks resets progress and project deletion cascades', async () => {
  await request(`/api/tasks/${taskId}`, { method: 'DELETE' });
  assert.equal((await request(`/api/projects/${projectId}`)).data.progress, 0);
  await request(`/api/projects/${projectId}`, { method: 'DELETE' });
  assert.equal((await request(`/api/projects/${projectId}`)).res.status, 404);
  const { q } = await import('../server/db.js');
  assert.equal((await q('SELECT * FROM members')).length, 0);
  assert.equal((await q('SELECT * FROM quality_items')).length, 0);
});
test('static frontend loads and logout clears the session', async () => {
  assert.match((await request('/')).data, /Temporary demo/);
  assert.equal((await request('/js/app.js')).res.status, 200);
  assert.match((await request('/api/auth/logout', { method: 'POST' })).res.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
});
test('Vercel refuses missing secrets or non-demo storage', () => {
  for (const override of [{ JWT_SECRET: '' }, { ADMIN_PASSWORD: '' }, { TARA_DEMO: 'false' }]) {
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./server/config.js')"], { env: { ...process.env, ...override }, encoding: 'utf8' });
    assert.notEqual(child.status, 0);
  }
});
