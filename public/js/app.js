// ====================== Tara PM front-end ======================
const App = (() => {
  let me = null;
  let caps = { gitlab: false, ai: false };

  const STATUS_COLORS = {
    planning: 'bg-slate-200 text-slate-700',
    active: 'bg-blue-100 text-blue-700',
    on_hold: 'bg-amber-100 text-amber-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  const PHASES = ['planning', 'execution', 'testing', 'delivery'];
  const PHASE_COLORS = {
    planning: 'bg-indigo-100 text-indigo-700',
    execution: 'bg-blue-100 text-blue-700',
    testing: 'bg-amber-100 text-amber-700',
    delivery: 'bg-emerald-100 text-emerald-700',
  };

  const $ = (id) => document.getElementById(id);
  const main = () => $('mainContent');

  // ---------- bootstrap ----------
  async function init() {
    try {
      const { user } = await API.get('/auth/me');
      me = user;
      await onAuthed();
    } catch {
      showLogin();
    }
  }

  function showLogin() {
    $('loginView').classList.remove('hidden');
    $('appView').classList.add('hidden');
  }

  async function onAuthed() {
    $('loginView').classList.add('hidden');
    $('appView').classList.remove('hidden');
    $('userName').textContent = me.full_name || me.username;
    // detect capabilities (GitLab + Claude) without blocking the UI
    API.get('/gitlab/status').then((s) => { caps.gitlab = s.configured; if (s.configured) $('gitlabBadge').classList.remove('hidden'); }).catch(() => {});
    API.get('/ai/status').then((s) => { caps.ai = s.available; if (s.available) $('aiBadge').classList.remove('hidden'); }).catch(() => {});
    goHome();
  }

  // ---------- auth actions ----------
  async function login(e) {
    e.preventDefault();
    const f = e.target;
    const errEl = $('loginError');
    errEl.classList.add('hidden');
    try {
      const res = await API.post('/auth/login', { username: f.username.value, password: f.password.value });
      me = res.user;
      await onAuthed();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  }

  async function logout() {
    await API.post('/auth/logout');
    location.reload();
  }

  // ====================== DASHBOARD ======================
  async function goHome() {
    main().innerHTML = `<div class="flex justify-center py-20"><div class="spinner"></div></div>`;
    const projects = await API.get('/projects');
    renderDashboard(projects);
  }

  function renderDashboard(projects) {
    const stats = {
      total: projects.length,
      active: projects.filter((p) => p.status === 'active').length,
      completed: projects.filter((p) => p.status === 'completed').length,
      avg: projects.length ? Math.round(projects.reduce((a, p) => a + p.progress, 0) / projects.length) : 0,
    };
    main().innerHTML = `
      <div class="flex items-center justify-between mb-5">
        <h1 class="text-2xl font-bold">Projects</h1>
        <button onclick="App.newProject()" class="bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2 rounded-lg">+ New Project</button>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        ${statCard('Total', stats.total, 'text-slate-800')}
        ${statCard('Active', stats.active, 'text-blue-600')}
        ${statCard('Completed', stats.completed, 'text-emerald-600')}
        ${statCard('Avg progress', stats.avg + '%', 'text-brand')}
      </div>
      <div id="projectGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>`;

    const grid = $('projectGrid');
    if (!projects.length) {
      grid.innerHTML = `<div class="col-span-full text-center text-slate-400 py-16">No projects yet. Create your first one.</div>`;
      return;
    }
    grid.innerHTML = projects.map(projectCard).join('');
  }

  const statCard = (label, value, color) => `
    <div class="bg-white rounded-xl p-4 shadow-sm">
      <div class="text-xs text-slate-500">${label}</div>
      <div class="text-2xl font-bold ${color}">${value}</div>
    </div>`;

  function projectCard(p) {
    return `
      <div onclick="App.openProject(${p.id})" class="bg-white rounded-xl shadow-sm hover:shadow-md transition cursor-pointer p-4">
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-semibold leading-tight">${UI.esc(p.name)}</h3>
          <span class="shrink-0 text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] || 'bg-slate-200'}">${p.status.replace('_', ' ')}</span>
        </div>
        <p class="text-xs text-slate-500 mt-1 capitalize">${UI.esc(p.project_type)} project</p>
        <p class="text-sm text-slate-600 mt-2 line-clamp-2 h-10 overflow-hidden">${UI.esc(p.description || '')}</p>
        ${progressBar(p.progress)}
        <div class="flex gap-4 text-xs text-slate-400 mt-3">
          <span>📋 ${p.task_count} tasks</span>
          <span>👥 ${p.member_count}</span>
          <span>📎 ${p.doc_count}</span>
        </div>
      </div>`;
  }

  function progressBar(pct) {
    const color = pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-brand';
    return `
      <div class="mt-3">
        <div class="flex justify-between text-xs text-slate-500 mb-1"><span>Progress</span><span>${pct}%</span></div>
        <div class="h-2 bg-slate-200 rounded-full overflow-hidden"><div class="h-full ${color} rounded-full transition-all" style="width:${pct}%"></div></div>
      </div>`;
  }

  // ====================== PROJECT CRUD ======================
  function projectForm(p = {}) {
    const types = ['web', 'mobile', 'desktop', 'api', 'data', 'other'];
    const statuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];
    return `
      <form id="projForm" class="space-y-3 text-sm">
        <div><label class="block font-medium mb-1">Name *</label>
          <input name="name" value="${UI.esc(p.name || '')}" required class="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
        <div><label class="block font-medium mb-1">Description</label>
          <textarea name="description" rows="3" class="w-full rounded-lg border border-slate-300 px-3 py-2">${UI.esc(p.description || '')}</textarea></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block font-medium mb-1">Type</label>
            <select name="project_type" class="w-full rounded-lg border border-slate-300 px-3 py-2">
              ${types.map((t) => `<option ${p.project_type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label class="block font-medium mb-1">Status</label>
            <select name="status" class="w-full rounded-lg border border-slate-300 px-3 py-2">
              ${statuses.map((s) => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}</select></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block font-medium mb-1">Start date</label>
            <input type="date" name="start_date" value="${p.start_date || ''}" class="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
          <div><label class="block font-medium mb-1">Due date</label>
            <input type="date" name="due_date" value="${p.due_date || ''}" class="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
        </div>
        <div><label class="block font-medium mb-1">GitLab project ID ${caps.gitlab ? '' : '(GitLab not configured)'}</label>
          <div class="flex gap-2">
            <input name="gitlab_project_id" value="${p.gitlab_project_id || ''}" placeholder="numeric id" class="w-full rounded-lg border border-slate-300 px-3 py-2" />
            ${caps.gitlab ? `<button type="button" onclick="App.pickGitlab()" class="shrink-0 px-3 rounded-lg border border-slate-300">Browse</button>` : ''}
          </div></div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="submit" class="px-4 py-2 rounded-lg bg-brand text-white font-semibold">Save</button>
        </div>
      </form>`;
  }

  function newProject() {
    const m = UI.modal('New Project', projectForm(), { wide: true });
    $('projForm').onsubmit = async (e) => {
      e.preventDefault();
      const data = formData(e.target);
      const { id } = await API.post('/projects', data);
      m.close(); UI.toast('Project created', 'success'); openProject(id);
    };
  }

  async function editProject(p) {
    const m = UI.modal('Edit Project', projectForm(p), { wide: true });
    $('projForm').onsubmit = async (e) => {
      e.preventDefault();
      await API.put('/projects/' + p.id, formData(e.target));
      m.close(); UI.toast('Saved', 'success'); openProject(p.id);
    };
  }

  async function deleteProject(id) {
    if (!(await UI.confirm('Delete this project and all its data?'))) return;
    await API.del('/projects/' + id);
    UI.toast('Project deleted', 'success');
    goHome();
  }

  // Lets the GitLab picker fill the form field.
  async function pickGitlab() {
    const m = UI.modal('Link GitLab Project', `<input id="glSearch" placeholder="search..." class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-3" /><div id="glList" class="space-y-1 max-h-72 overflow-y-auto text-sm"></div>`, { wide: true });
    const load = async (s) => {
      $('glList').innerHTML = `<div class="flex justify-center py-6"><div class="spinner"></div></div>`;
      try {
        const list = await API.get('/gitlab/projects' + (s ? '?search=' + encodeURIComponent(s) : ''));
        $('glList').innerHTML = list.map((g) => `
          <div class="flex items-center justify-between p-2 rounded hover:bg-slate-50">
            <div><div class="font-medium">${UI.esc(g.name)}</div><div class="text-xs text-slate-400">${UI.esc(g.path_with_namespace)} · id ${g.id}</div></div>
            <button onclick="App._setGitlab(${g.id})" class="text-xs px-2 py-1 rounded bg-brand text-white">Select</button>
          </div>`).join('') || '<div class="text-slate-400 text-center py-4">No projects</div>';
      } catch (e) { $('glList').innerHTML = `<div class="text-red-600 text-sm">${UI.esc(e.message)}</div>`; }
    };
    let t; $('glSearch').oninput = (e) => { clearTimeout(t); t = setTimeout(() => load(e.target.value), 350); };
    window.App._setGitlab = (id) => { const f = document.querySelector('#projForm [name=gitlab_project_id]'); if (f) f.value = id; m.close(); };
    load('');
  }

  // ====================== PROJECT DETAIL ======================
  let current = null;
  let activeTab = 'overview';

  async function openProject(id, tab = 'overview') {
    activeTab = tab;
    main().innerHTML = `<div class="flex justify-center py-20"><div class="spinner"></div></div>`;
    current = await API.get('/projects/' + id);
    renderProject();
  }
  const reload = () => openProject(current.id, activeTab);

  function renderProject() {
    const p = current;
    const tabs = [
      ['overview', 'Overview'], ['timeline', 'Timeline'], ['team', 'Team & Roles'],
      ['documents', 'Documents'], ['quality', 'Quality'],
    ];
    if (caps.gitlab && p.gitlab_project_id) tabs.push(['gitlab', 'GitLab']);
    if (caps.ai) tabs.push(['ai', 'AI Assistant']);

    main().innerHTML = `
      <button onclick="App.goHome()" class="text-sm text-slate-500 hover:text-brand mb-3">← All projects</button>
      <div class="bg-white rounded-xl shadow-sm p-5 mb-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-bold">${UI.esc(p.name)}</h1>
              <span class="text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}">${p.status.replace('_', ' ')}</span>
            </div>
            <p class="text-sm text-slate-500 mt-1 capitalize">${UI.esc(p.project_type)} project</p>
            <p class="text-sm text-slate-600 mt-2 max-w-2xl">${UI.esc(p.description || '')}</p>
            <div class="flex gap-4 text-xs text-slate-400 mt-2">
              ${p.start_date ? `<span>Start: ${p.start_date}</span>` : ''}
              ${p.due_date ? `<span>Due: ${p.due_date}</span>` : ''}
            </div>
          </div>
          <div class="flex gap-2 shrink-0">
            <button onclick='App.editProject(${JSON.stringify(p).replace(/'/g, "&#39;")})' class="text-sm px-3 py-1.5 rounded-lg border border-slate-300">Edit</button>
            <button onclick="App.deleteProject(${p.id})" class="text-sm px-3 py-1.5 rounded-lg border border-red-300 text-red-600">Delete</button>
          </div>
        </div>
        <div class="mt-4 max-w-md">${progressBar(p.progress)}</div>
      </div>
      <div class="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
        ${tabs.map(([k, label]) => `
          <button onclick="App.setTab('${k}')" class="px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === k ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-700'}">${label}</button>`).join('')}
      </div>
      <div id="tabBody"></div>`;
    renderTab();
  }

  function setTab(k) { activeTab = k; renderProject(); }

  function renderTab() {
    const body = $('tabBody');
    ({
      overview: tabOverview, timeline: tabTimeline, team: tabTeam,
      documents: tabDocuments, quality: tabQuality, gitlab: tabGitlab, ai: tabAI,
    }[activeTab] || tabOverview)(body);
  }

  // ---------- Overview ----------
  function tabOverview(el) {
    const p = current;
    const byPhase = PHASES.map((ph) => ({ ph, n: p.tasks.filter((t) => t.phase === ph).length }));
    const q = p.quality;
    const qPass = q.filter((i) => i.status === 'passed').length;
    el.innerHTML = `
      <div class="grid md:grid-cols-3 gap-4">
        <div class="bg-white rounded-xl p-4 shadow-sm">
          <h3 class="font-semibold mb-2 text-sm">Task phases</h3>
          ${byPhase.map((b) => `<div class="flex justify-between text-sm py-1"><span class="capitalize">${b.ph}</span><span class="px-2 rounded-full text-xs ${PHASE_COLORS[b.ph]}">${b.n}</span></div>`).join('')}
        </div>
        <div class="bg-white rounded-xl p-4 shadow-sm">
          <h3 class="font-semibold mb-2 text-sm">Team</h3>
          ${p.members.length ? p.members.slice(0, 6).map((m) => `<div class="text-sm py-0.5">${UI.esc(m.name)} — <span class="text-slate-500">${UI.esc(m.role)}</span></div>`).join('') : '<div class="text-sm text-slate-400">No members yet</div>'}
        </div>
        <div class="bg-white rounded-xl p-4 shadow-sm">
          <h3 class="font-semibold mb-2 text-sm">Quality</h3>
          <div class="text-sm">${q.length ? `${qPass}/${q.length} criteria passed` : 'No quality items yet'}</div>
          <div class="text-sm mt-2">📎 ${p.documents.length} documents</div>
        </div>
      </div>`;
  }

  // ---------- Timeline (feature 4 & 7) ----------
  function tabTimeline(el) {
    const p = current;
    el.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold">Timeline & Tasks</h3>
        <div class="flex gap-2">
          ${caps.ai ? `<button onclick="App.aiTimeline()" class="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white">✨ Generate with AI</button>` : ''}
          <button onclick="App.taskForm()" class="text-sm px-3 py-1.5 rounded-lg bg-brand text-white">+ Task</button>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr><th class="text-left p-3">Task</th><th class="text-left p-3">Phase</th><th class="text-left p-3">Start</th><th class="text-left p-3">End</th><th class="text-left p-3">Team</th><th class="text-left p-3">Status</th><th></th></tr>
          </thead>
          <tbody>
            ${p.tasks.length ? p.tasks.map(taskRow).join('') : `<tr><td colspan="7" class="text-center text-slate-400 py-8">No tasks. Add one or generate with AI.</td></tr>`}
          </tbody>
        </table>
      </div>`;
  }

  function taskRow(t) {
    const statusColor = { todo: 'bg-slate-200 text-slate-600', in_progress: 'bg-blue-100 text-blue-700', done: 'bg-emerald-100 text-emerald-700', blocked: 'bg-red-100 text-red-700' };
    return `
      <tr class="border-t border-slate-100">
        <td class="p-3 font-medium">${UI.esc(t.title)}</td>
        <td class="p-3"><span class="text-xs px-2 py-0.5 rounded-full ${PHASE_COLORS[t.phase] || ''} capitalize">${t.phase}</span></td>
        <td class="p-3 text-slate-500">${t.start_date || '—'}</td>
        <td class="p-3 text-slate-500">${t.end_date || '—'}</td>
        <td class="p-3 text-slate-500">${UI.esc(t.responsible_team || '—')}</td>
        <td class="p-3"><span class="text-xs px-2 py-0.5 rounded-full ${statusColor[t.status]}">${t.status.replace('_', ' ')}</span></td>
        <td class="p-3 text-right whitespace-nowrap">
          <button onclick='App.taskForm(${JSON.stringify(t).replace(/'/g, "&#39;")})' class="text-slate-400 hover:text-brand">✎</button>
          <button onclick="App.deleteTask(${t.id})" class="text-slate-400 hover:text-red-600 ml-2">🗑</button>
        </td>
      </tr>`;
  }

  function taskForm(t = {}) {
    const statuses = ['todo', 'in_progress', 'done', 'blocked'];
    const m = UI.modal(t.id ? 'Edit Task' : 'New Task', `
      <form id="taskForm" class="space-y-3 text-sm">
        <div><label class="block font-medium mb-1">Title *</label><input name="title" value="${UI.esc(t.title || '')}" required class="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block font-medium mb-1">Phase</label><select name="phase" class="w-full rounded-lg border border-slate-300 px-3 py-2">${PHASES.map((ph) => `<option ${t.phase === ph ? 'selected' : ''}>${ph}</option>`).join('')}</select></div>
          <div><label class="block font-medium mb-1">Status</label><select name="status" class="w-full rounded-lg border border-slate-300 px-3 py-2">${statuses.map((s) => `<option value="${s}" ${t.status === s ? 'selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}</select></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block font-medium mb-1">Start</label><input type="date" name="start_date" value="${t.start_date || ''}" class="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
          <div><label class="block font-medium mb-1">End</label><input type="date" name="end_date" value="${t.end_date || ''}" class="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
        </div>
        <div><label class="block font-medium mb-1">Responsible team</label><input name="responsible_team" value="${UI.esc(t.responsible_team || '')}" class="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
        <div class="flex justify-end"><button class="px-4 py-2 rounded-lg bg-brand text-white font-semibold">Save</button></div>
      </form>`);
    $('taskForm').onsubmit = async (e) => {
      e.preventDefault();
      const data = formData(e.target);
      if (t.id) await API.put('/tasks/' + t.id, data);
      else await API.post('/tasks/project/' + current.id, data);
      m.close(); UI.toast('Saved', 'success'); reload();
    };
  }
  async function deleteTask(id) { if (!(await UI.confirm('Delete this task?'))) return; await API.del('/tasks/' + id); reload(); }

  async function aiTimeline() {
    const m = UI.modal('Generate Timeline with AI', `
      <p class="text-sm text-slate-600 mb-3">Claude will draft a phased timeline (planning → execution → testing → delivery) and add the tasks to this project.</p>
      <label class="block text-sm font-medium mb-1">Project domain</label>
      <select id="aiDomain" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-4">
        <option>software development</option><option>marketing</option><option>construction</option>
      </select>
      <div id="aiTlStatus"></div>
      <div class="flex justify-end"><button id="aiTlGo" class="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold">Generate</button></div>`);
    $('aiTlGo').onclick = async () => {
      $('aiTlStatus').innerHTML = `<div class="flex items-center gap-2 text-sm text-slate-500 mb-3"><div class="spinner"></div> Claude is working… (can take ~30s)</div>`;
      $('aiTlGo').disabled = true;
      try {
        const res = await API.post('/ai/project/' + current.id + '/timeline', { domain: $('aiDomain').value });
        m.close(); UI.toast(`Added ${res.created} tasks`, 'success'); reload();
      } catch (e) {
        $('aiTlStatus').innerHTML = `<div class="text-sm text-red-600 mb-3">${UI.esc(e.message)}</div>`;
        $('aiTlGo').disabled = false;
      }
    };
  }

  // ---------- Team & Roles (feature 5) ----------
  function tabTeam(el) {
    const p = current;
    el.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold">Team, Roles & Reporting</h3>
        <button onclick="App.memberForm()" class="text-sm px-3 py-1.5 rounded-lg bg-brand text-white">+ Member</button>
      </div>
      <div class="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500 text-xs uppercase"><tr>
            <th class="text-left p-3">Name</th><th class="text-left p-3">Role</th><th class="text-left p-3">Responsibility</th><th class="text-left p-3">Reports to</th><th class="text-left p-3">Contact</th><th></th></tr></thead>
          <tbody>${p.members.length ? p.members.map(memberRow).join('') : `<tr><td colspan="6" class="text-center text-slate-400 py-8">No team members yet.</td></tr>`}</tbody>
        </table>
      </div>`;
  }
  function memberRow(m) {
    return `<tr class="border-t border-slate-100">
      <td class="p-3 font-medium">${UI.esc(m.name)}</td>
      <td class="p-3">${UI.esc(m.role)}</td>
      <td class="p-3 text-slate-500 max-w-xs">${UI.esc(m.responsibility || '—')}</td>
      <td class="p-3 text-slate-500">${UI.esc(m.reports_to || '—')}</td>
      <td class="p-3 text-slate-500">${UI.esc(m.contact || '—')}</td>
      <td class="p-3 text-right whitespace-nowrap">
        <button onclick='App.memberForm(${JSON.stringify(m).replace(/'/g, "&#39;")})' class="text-slate-400 hover:text-brand">✎</button>
        <button onclick="App.deleteMember(${m.id})" class="text-slate-400 hover:text-red-600 ml-2">🗑</button>
      </td></tr>`;
  }
  function memberForm(mem = {}) {
    const m = UI.modal(mem.id ? 'Edit Member' : 'New Member', `
      <form id="memForm" class="space-y-3 text-sm">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block font-medium mb-1">Name *</label><input name="name" value="${UI.esc(mem.name || '')}" required class="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
          <div><label class="block font-medium mb-1">Role *</label><input name="role" value="${UI.esc(mem.role || '')}" required placeholder="e.g. Backend Dev" class="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
        </div>
        <div><label class="block font-medium mb-1">Responsibility</label><textarea name="responsibility" rows="2" class="w-full rounded-lg border border-slate-300 px-3 py-2">${UI.esc(mem.responsibility || '')}</textarea></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block font-medium mb-1">Reports to</label><input name="reports_to" value="${UI.esc(mem.reports_to || '')}" class="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
          <div><label class="block font-medium mb-1">Contact</label><input name="contact" value="${UI.esc(mem.contact || '')}" placeholder="email / chat" class="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
        </div>
        <div class="flex justify-end"><button class="px-4 py-2 rounded-lg bg-brand text-white font-semibold">Save</button></div>
      </form>`);
    $('memForm').onsubmit = async (e) => {
      e.preventDefault();
      const data = formData(e.target);
      if (mem.id) await API.put('/members/' + mem.id, data);
      else await API.post('/members/project/' + current.id, data);
      m.close(); UI.toast('Saved', 'success'); reload();
    };
  }
  async function deleteMember(id) { if (!(await UI.confirm('Remove this member?'))) return; await API.del('/members/' + id); reload(); }

  // ---------- Documents (feature 2) ----------
  function tabDocuments(el) {
    const p = current;
    el.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold">Documents</h3>
        <button onclick="App.uploadDoc()" class="text-sm px-3 py-1.5 rounded-lg bg-brand text-white">+ Upload</button>
      </div>
      <div class="bg-white rounded-xl shadow-sm divide-y divide-slate-100">
        ${p.documents.length ? p.documents.map((d) => `
          <div class="flex items-center justify-between p-3 text-sm">
            <div class="min-w-0">
              <div class="font-medium truncate">${UI.esc(d.original_name)}</div>
              <div class="text-xs text-slate-400">${UI.esc(d.category)} · ${fmtBytes(d.size_bytes)} · ${d.created_at?.slice(0, 10) || ''}</div>
            </div>
            <div class="shrink-0 flex gap-3">
              <a href="/api/documents/${d.id}/download" class="text-brand hover:underline">Download</a>
              <button onclick="App.deleteDoc(${d.id})" class="text-red-500 hover:underline">Delete</button>
            </div>
          </div>`).join('') : `<div class="text-center text-slate-400 py-8 text-sm">No documents attached.</div>`}
      </div>`;
  }
  function uploadDoc() {
    const m = UI.modal('Upload Document', `
      <form id="docForm" class="space-y-3 text-sm">
        <div><label class="block font-medium mb-1">File *</label><input type="file" name="file" required class="w-full text-sm" /></div>
        <div><label class="block font-medium mb-1">Category</label>
          <select name="category" class="w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="general">General</option><option value="spec">Specification</option>
            <option value="design">Design</option><option value="contract">Contract</option><option value="report">Report</option></select></div>
        <div id="docStatus"></div>
        <div class="flex justify-end"><button class="px-4 py-2 rounded-lg bg-brand text-white font-semibold">Upload</button></div>
      </form>`);
    $('docForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      $('docStatus').innerHTML = `<div class="flex items-center gap-2 text-slate-500"><div class="spinner"></div> Uploading…</div>`;
      try {
        await API.upload('/documents/project/' + current.id, fd);
        m.close(); UI.toast('Uploaded', 'success'); reload();
      } catch (err) { $('docStatus').innerHTML = `<div class="text-red-600">${UI.esc(err.message)}</div>`; }
    };
  }
  async function deleteDoc(id) { if (!(await UI.confirm('Delete this document?'))) return; await API.del('/documents/' + id); reload(); }

  // ---------- Quality (feature 6) ----------
  function tabQuality(el) {
    const p = current;
    const statusColor = { pending: 'bg-slate-200 text-slate-600', passed: 'bg-emerald-100 text-emerald-700', failed: 'bg-red-100 text-red-700', na: 'bg-slate-100 text-slate-400' };
    el.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold">Quality Management Plan</h3>
        <div class="flex gap-2">
          ${caps.ai ? `<button onclick="App.aiQuality()" class="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white">✨ Generate with AI</button>` : ''}
          <button onclick="App.qualityForm()" class="text-sm px-3 py-1.5 rounded-lg bg-brand text-white">+ Criterion</button>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500 text-xs uppercase"><tr>
            <th class="text-left p-3">Standard / Criterion</th><th class="text-left p-3">Verification</th><th class="text-left p-3">Status</th><th class="text-left p-3">Notes</th><th></th></tr></thead>
          <tbody>${p.quality.length ? p.quality.map((i) => `
            <tr class="border-t border-slate-100">
              <td class="p-3 font-medium">${UI.esc(i.standard)}</td>
              <td class="p-3 text-slate-500">${UI.esc(i.method || '—')}</td>
              <td class="p-3"><span class="text-xs px-2 py-0.5 rounded-full ${statusColor[i.status]}">${i.status}</span></td>
              <td class="p-3 text-slate-500 max-w-xs">${UI.esc(i.notes || '—')}</td>
              <td class="p-3 text-right whitespace-nowrap">
                <button onclick='App.qualityForm(${JSON.stringify(i).replace(/'/g, "&#39;")})' class="text-slate-400 hover:text-brand">✎</button>
                <button onclick="App.deleteQuality(${i.id})" class="text-slate-400 hover:text-red-600 ml-2">🗑</button>
              </td></tr>`).join('') : `<tr><td colspan="5" class="text-center text-slate-400 py-8">No quality criteria yet.</td></tr>`}
          </tbody>
        </table>
      </div>`;
  }
  function qualityForm(it = {}) {
    const statuses = ['pending', 'passed', 'failed', 'na'];
    const m = UI.modal(it.id ? 'Edit Criterion' : 'New Criterion', `
      <form id="qForm" class="space-y-3 text-sm">
        <div><label class="block font-medium mb-1">Standard *</label><input name="standard" value="${UI.esc(it.standard || '')}" required class="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
        <div><label class="block font-medium mb-1">Verification method</label><input name="method" value="${UI.esc(it.method || '')}" placeholder="review / test / audit" class="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
        <div><label class="block font-medium mb-1">Status</label><select name="status" class="w-full rounded-lg border border-slate-300 px-3 py-2">${statuses.map((s) => `<option ${it.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div><label class="block font-medium mb-1">Notes</label><textarea name="notes" rows="2" class="w-full rounded-lg border border-slate-300 px-3 py-2">${UI.esc(it.notes || '')}</textarea></div>
        <div class="flex justify-end"><button class="px-4 py-2 rounded-lg bg-brand text-white font-semibold">Save</button></div>
      </form>`);
    $('qForm').onsubmit = async (e) => {
      e.preventDefault();
      const data = formData(e.target);
      if (it.id) await API.put('/quality/' + it.id, data);
      else await API.post('/quality/project/' + current.id, data);
      m.close(); UI.toast('Saved', 'success'); reload();
    };
  }
  async function deleteQuality(id) { if (!(await UI.confirm('Delete this criterion?'))) return; await API.del('/quality/' + id); reload(); }
  async function aiQuality() {
    UI.toast('Claude is drafting a quality checklist…');
    try { const res = await API.post('/ai/project/' + current.id + '/quality', {}); UI.toast(`Added ${res.created} criteria`, 'success'); reload(); }
    catch (e) { UI.toast(e.message, 'error'); }
  }

  // ---------- GitLab (feature 3) ----------
  async function tabGitlab(el) {
    el.innerHTML = `<div class="flex justify-center py-10"><div class="spinner"></div></div>`;
    try {
      const a = await API.get('/gitlab/projects/' + current.gitlab_project_id + '/activity');
      el.innerHTML = `
        <div class="grid md:grid-cols-2 gap-4">
          <div class="bg-white rounded-xl shadow-sm p-4">
            <h3 class="font-semibold text-sm mb-2">Repository</h3>
            <div class="text-sm"><a href="${UI.esc(a.project.web_url)}" target="_blank" class="text-brand hover:underline font-medium">${UI.esc(a.project.name_with_namespace)}</a></div>
            <div class="text-xs text-slate-400 mt-1">Default branch: ${UI.esc(a.project.default_branch || '—')} · ⭐ ${a.project.star_count ?? 0}</div>
          </div>
          <div class="bg-white rounded-xl shadow-sm p-4">
            <h3 class="font-semibold text-sm mb-2">Pipelines</h3>
            ${(a.pipelines || []).slice(0, 5).map((p) => `<div class="flex justify-between text-sm py-0.5"><span>#${p.id} · ${UI.esc(p.ref)}</span><span class="${p.status === 'success' ? 'text-emerald-600' : p.status === 'failed' ? 'text-red-600' : 'text-slate-500'}">${p.status}</span></div>`).join('') || '<div class="text-sm text-slate-400">No pipelines</div>'}
          </div>
          <div class="bg-white rounded-xl shadow-sm p-4">
            <h3 class="font-semibold text-sm mb-2">Recent commits</h3>
            ${(a.commits || []).slice(0, 8).map((c) => `<div class="text-sm py-0.5 truncate"><span class="text-slate-400">${c.short_id}</span> ${UI.esc(c.title)}</div>`).join('') || '<div class="text-sm text-slate-400">No commits</div>'}
          </div>
          <div class="bg-white rounded-xl shadow-sm p-4">
            <h3 class="font-semibold text-sm mb-2">Open issues (${(a.issues || []).length})</h3>
            ${(a.issues || []).slice(0, 8).map((i) => `<div class="text-sm py-0.5 truncate">#${i.iid} ${UI.esc(i.title)}</div>`).join('') || '<div class="text-sm text-slate-400">No open issues</div>'}
          </div>
        </div>`;
    } catch (e) {
      el.innerHTML = `<div class="bg-white rounded-xl p-6 text-sm text-red-600">Could not load GitLab data: ${UI.esc(e.message)}</div>`;
    }
  }

  // ---------- AI Assistant (features 7 & 8 + free chat) ----------
  function tabAI(el) {
    el.innerHTML = `
      <div class="grid md:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl shadow-sm p-4">
          <h3 class="font-semibold text-sm mb-2">Resource Plan (feature 8)</h3>
          <p class="text-xs text-slate-500 mb-3">Analyze human / material / technology needs by phase with an allocation strategy.</p>
          <button onclick="App.aiResources()" class="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white">Generate resource plan</button>
          <div id="aiResOut" class="markdown mt-3 text-sm"></div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-4">
          <h3 class="font-semibold text-sm mb-2">Ask Claude about this project</h3>
          <textarea id="aiQ" rows="3" placeholder="e.g. What are the top risks given the current timeline?" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"></textarea>
          <button onclick="App.aiAsk()" class="mt-2 text-sm px-3 py-1.5 rounded-lg bg-brand text-white">Ask</button>
          <div id="aiAskOut" class="markdown mt-3 text-sm"></div>
        </div>
      </div>`;
  }
  async function aiResources() {
    const out = $('aiResOut');
    out.innerHTML = `<div class="flex items-center gap-2 text-slate-500"><div class="spinner"></div> Working…</div>`;
    try { const r = await API.post('/ai/project/' + current.id + '/resources', {}); out.innerHTML = UI.markdown(r.markdown); }
    catch (e) { out.innerHTML = `<div class="text-red-600">${UI.esc(e.message)}</div>`; }
  }
  async function aiAsk() {
    const q = $('aiQ').value.trim();
    if (!q) return;
    const out = $('aiAskOut');
    out.innerHTML = `<div class="flex items-center gap-2 text-slate-500"><div class="spinner"></div> Thinking…</div>`;
    try { const r = await API.post('/ai/project/' + current.id + '/ask', { question: q }); out.innerHTML = UI.markdown(r.markdown); }
    catch (e) { out.innerHTML = `<div class="text-red-600">${UI.esc(e.message)}</div>`; }
  }

  // ---------- Account / users ----------
  async function openAccount() {
    let usersHtml = '';
    if (me.is_admin) {
      try {
        const users = await API.get('/auth/users');
        usersHtml = `
          <div class="mt-5 pt-4 border-t border-slate-200">
            <div class="flex items-center justify-between mb-2"><h4 class="font-semibold text-sm">Users</h4>
              <button onclick="App.newUser()" class="text-xs px-2 py-1 rounded bg-brand text-white">+ Add user</button></div>
            ${users.map((u) => `<div class="text-sm py-0.5 flex justify-between"><span>${UI.esc(u.full_name)} <span class="text-slate-400">@${UI.esc(u.username)}</span></span>${u.is_admin ? '<span class="text-xs text-brand">admin</span>' : ''}</div>`).join('')}
          </div>`;
      } catch {}
    }
    UI.modal('Account', `
      <form id="pwForm" class="space-y-3 text-sm">
        <h4 class="font-semibold">Change password</h4>
        <input name="current" type="password" placeholder="Current password" required class="w-full rounded-lg border border-slate-300 px-3 py-2" />
        <input name="next" type="password" placeholder="New password" required class="w-full rounded-lg border border-slate-300 px-3 py-2" />
        <div class="flex justify-end"><button class="px-4 py-2 rounded-lg bg-brand text-white font-semibold">Update</button></div>
      </form>${usersHtml}`);
    $('pwForm').onsubmit = async (e) => {
      e.preventDefault();
      try { await API.post('/auth/change-password', formData(e.target)); UI.toast('Password changed', 'success'); document.getElementById('modalRoot').innerHTML = ''; }
      catch (err) { UI.toast(err.message, 'error'); }
    };
  }
  function newUser() {
    const m = UI.modal('Add User', `
      <form id="uForm" class="space-y-3 text-sm">
        <input name="full_name" placeholder="Full name" required class="w-full rounded-lg border border-slate-300 px-3 py-2" />
        <input name="username" placeholder="Username" required class="w-full rounded-lg border border-slate-300 px-3 py-2" />
        <input name="password" type="password" placeholder="Password" required class="w-full rounded-lg border border-slate-300 px-3 py-2" />
        <label class="flex items-center gap-2"><input type="checkbox" name="is_admin" /> Admin</label>
        <div class="flex justify-end"><button class="px-4 py-2 rounded-lg bg-brand text-white font-semibold">Create</button></div>
      </form>`);
    $('uForm').onsubmit = async (e) => {
      e.preventDefault();
      const data = formData(e.target);
      data.is_admin = e.target.is_admin.checked;
      try { await API.post('/auth/users', data); m.close(); UI.toast('User created', 'success'); }
      catch (err) { UI.toast(err.message, 'error'); }
    };
  }

  // ---------- helpers ----------
  function formData(form) {
    const o = {};
    new FormData(form).forEach((v, k) => { o[k] = v; });
    return o;
  }
  function fmtBytes(b) {
    if (!b) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB']; let i = 0; b = Number(b);
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return `${b.toFixed(b < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
  }

  // expose
  return {
    init, login, logout, goHome, newProject, editProject, deleteProject, openProject,
    setTab, pickGitlab, _setGitlab: null,
    taskForm, deleteTask, aiTimeline, memberForm, deleteMember,
    uploadDoc, deleteDoc, qualityForm, deleteQuality, aiQuality,
    aiResources, aiAsk, openAccount, newUser,
  };
})();

document.getElementById('loginForm').addEventListener('submit', App.login);
App.init();
