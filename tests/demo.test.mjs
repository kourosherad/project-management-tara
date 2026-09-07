import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';

function browser(indexedDB = new IDBFactory(), session = new Map()) {
  const context = vm.createContext({ indexedDB, crypto, TextEncoder, Blob, URL, setTimeout,
    sessionStorage: { getItem: k => session.get(k), setItem: (k,v) => session.set(k,v), removeItem: k => session.delete(k) },
  });
  vm.runInContext(readFileSync('public/js/demo.js', 'utf8'), context);
  const demo = vm.runInContext('TaraDemo', context);
  let calls = 0;
  const network = async (method, url, body) => {
    calls++;
    assert.equal(url, '/auth/login');
    if (body.password !== 'initial-password') throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    return { user: { id: 1, username: 'admin', full_name: 'Owner', is_admin: true } };
  };
  return { request: (method, url, body) => demo.request(method, url, body, network), calls: () => calls, indexedDB, session };
}

test('browser demo verifies first login, persists edits across reloads, and isolates browsers', async () => {
  const b = browser();
  await assert.rejects(b.request('GET', '/auth/me'), { status: 401 });
  await assert.rejects(b.request('POST', '/auth/login', { username: 'admin', password: 'wrong' }), { status: 401 });
  await b.request('POST', '/auth/login', { username: 'admin', password: 'initial-password' });
  const { id } = await b.request('POST', '/projects', { name: 'Personal trial' });
  const task = await b.request('POST', `/tasks/project/${id}`, { title: 'Verify the demo', responsible_team: 'Owner' });
  await b.request('PUT', `/tasks/${task.id}`, { title: 'Verify the demo', status: 'done' });
  const reloaded = browser(b.indexedDB, b.session);
  const saved = await reloaded.request('GET', `/projects/${id}`);
  assert.equal(saved.progress, 100); assert.equal(saved.tasks.length, 1);
  assert.equal(reloaded.calls(), 0, 'reading or editing workspace never depends on a server instance');
  const other = browser();
  await other.request('POST', '/auth/login', { username: 'admin', password: 'initial-password' });
  assert.equal((await other.request('GET', '/projects')).length, 0);
});

test('demo accounts, permissions, password changes and logout persist locally', async () => {
  const b = browser();
  await b.request('POST', '/auth/login', { username: 'admin', password: 'initial-password' });
  await b.request('POST', '/auth/users', { username: 'friend', full_name: 'Friend', password: 'friend-password' });
  await assert.rejects(b.request('POST', '/auth/users', { username: 'friend', full_name: 'Friend', password: 'x' }), { status: 409 });
  await b.request('POST', '/auth/change-password', { current: 'initial-password', next: 'new-password' });
  await b.request('POST', '/auth/logout');
  await assert.rejects(b.request('GET', '/projects'), { status: 401 });
  await assert.rejects(b.request('POST', '/auth/login', { username: 'admin', password: 'initial-password' }), { status: 401 });
  await b.request('POST', '/auth/login', { username: 'friend', password: 'friend-password' });
  await assert.rejects(b.request('GET', '/auth/users'), { status: 403 });
  await b.request('POST', '/auth/logout');
  await b.request('POST', '/auth/login', { username: 'admin', password: 'new-password' });
  assert.equal(b.calls(), 1);
});

test('demo retains uploaded files, cascades deletes, and serializes quick task creation', async () => {
  const b = browser();
  await b.request('POST', '/auth/login', { username: 'admin', password: 'initial-password' });
  const { id } = await b.request('POST', '/projects', { name: 'Trial' });
  await Promise.all(Array.from({ length: 5 }, (_, i) => b.request('POST', `/tasks/project/${id}`, { title: 'Task ' + i })));
  await b.request('POST', `/members/project/${id}`, { name: 'Friend', role: 'Reviewer' });
  await b.request('POST', `/quality/project/${id}`, { standard: 'Tasks persist', status: 'passed' });
  const form = new FormData(); form.set('file', new Blob(['Sample brief']), 'brief.txt'); form.set('category', 'spec');
  await b.request('POST', `/documents/project/${id}`, form);
  const big = new FormData(); big.set('file', new Blob([new Uint8Array(3 * 1024 * 1024 + 1)]), 'big.bin');
  await assert.rejects(b.request('POST', `/documents/project/${id}`, big), { status: 413 });
  const project = await b.request('GET', `/projects/${id}`);
  assert.equal(project.tasks.length, 5); assert.equal(project.members.length, 1); assert.equal(project.quality.length, 1);
  assert.equal(project.documents[0].original_name, 'brief.txt'); assert.equal(project.documents[0].file, undefined);
  const db = await new Promise(resolve => { const r = b.indexedDB.open('tara-demo-v1'); r.onsuccess = () => resolve(r.result); });
  async function state() { return new Promise(resolve => { const r = db.transaction('workspace').objectStore('workspace').get('data'); r.onsuccess = () => resolve(r.result); }); }
  assert.equal(await (await state()).documents[0].file.text(), 'Sample brief');
  await b.request('DELETE', `/projects/${id}`);
  const cleared = await state();
  for (const table of ['projects','tasks','members','quality','documents']) assert.equal(cleared[table].length, 0);
  assert.equal((await b.request('GET', '/ai/status')).available, false);
  assert.equal((await b.request('GET', '/gitlab/status')).configured, false);
});
