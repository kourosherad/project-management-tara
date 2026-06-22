// Thin wrapper around the local GitLab REST API (v4).
import fetch from 'node-fetch';

const BASE = (process.env.GITLAB_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.GITLAB_TOKEN || '';

export function gitlabConfigured() {
  return Boolean(BASE && TOKEN);
}

async function gl(pathAndQuery) {
  if (!gitlabConfigured()) {
    const e = new Error('GitLab is not configured. Set GITLAB_URL and GITLAB_TOKEN in .env');
    e.status = 503;
    throw e;
  }
  const url = `${BASE}/api/v4${pathAndQuery}`;
  const res = await fetch(url, { headers: { 'PRIVATE-TOKEN': TOKEN } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const e = new Error(`GitLab API ${res.status}: ${body.slice(0, 200)}`);
    e.status = res.status;
    throw e;
  }
  return res.json();
}

// List projects the token can see (for picking one to link).
export function listProjects(search = '') {
  const s = search ? `&search=${encodeURIComponent(search)}` : '';
  return gl(`/projects?membership=true&simple=true&per_page=50&order_by=last_activity_at${s}`);
}

export function getProject(id) {
  return gl(`/projects/${encodeURIComponent(id)}`);
}

// Recent commits on the default branch.
export function getCommits(id) {
  return gl(`/projects/${encodeURIComponent(id)}/repository/commits?per_page=15`);
}

// Latest CI pipelines.
export function getPipelines(id) {
  return gl(`/projects/${encodeURIComponent(id)}/pipelines?per_page=10`);
}

// Open issues (used to reflect work status).
export function getIssues(id) {
  return gl(`/projects/${encodeURIComponent(id)}/issues?state=opened&per_page=20`);
}
