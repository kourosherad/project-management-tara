// A disposable workspace per browser. No shared server filesystem is required.
const TaraDemo = (() => {
  const STORE = 'workspace';
  const SESSION = 'tara-demo-user';
  let dbPromise;
  function database() {
    return dbPromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('tara-demo-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Browser storage is unavailable. Allow site storage to use the demo.'));
    });
  }
  const empty = () => ({ nextId: 1, users: [], projects: [], tasks: [], members: [], documents: [], quality: [] });
  async function read() {
    const db = await database();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get('data');
      request.onsuccess = () => resolve(request.result || empty());
      request.onerror = () => reject(request.error);
    });
  }
  async function write(state) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(state, 'data');
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () => reject(new Error('Could not save demo data. Browser storage may be full or disabled.'));
    });
  }
  function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
  const safeUser = ({ id, username, full_name, is_admin }) => ({ id, username, full_name, is_admin });
  const safeDoc = ({ file, ...meta }) => meta;
  const now = () => new Date().toISOString();
  async function hash(password, salt) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
    return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
  }
  async function credentials(password) {
    const salt = crypto.randomUUID();
    return { salt, password_hash: await hash(password, salt) };
  }
  function progress(state, id) {
    const tasks = state.tasks.filter(t => t.project_id === id);
    const project = state.projects.find(p => p.id === id);
    if (project) project.progress = tasks.length ? Math.round(tasks.filter(t => t.status === 'done').length / tasks.length * 100) : 0;
    return project?.progress || 0;
  }
  const projectData = body => ({ name: body.name, description: body.description || '', project_type: body.project_type || 'web', status: body.status || 'planning', start_date: body.start_date || null, due_date: body.due_date || null, gitlab_project_id: null });
  function detail(state, project) {
    const id = project.id;
    return { ...project, tasks: state.tasks.filter(t => t.project_id === id).sort((a,b) => a.sort_order - b.sort_order), members: state.members.filter(m => m.project_id === id), documents: state.documents.filter(d => d.project_id === id).map(safeDoc), quality: state.quality.filter(q => q.project_id === id) };
  }
  // Serialize operations within this tab so quick edits cannot overwrite each other.
  let queue = Promise.resolve();
  function request(method, url, body, network) {
    const result = queue.then(() => handle(method, url, body || {}, network));
    queue = result.catch(() => {});
    return result;
  }
  async function handle(method, url, body, network) {
    const state = await read();
    if (url === '/auth/login' && method === 'POST') {
      if (!body.username || !body.password) fail('Username and password required');
      let user = state.users.find(u => u.username === body.username);
      if (!state.users.length) {
        // Verify the initial admin using the configured deployment password.
        const verified = await network(method, url, body);
        user = { ...verified.user, id: state.nextId++, ...await credentials(body.password) };
        state.users.push(user);
        await write(state);
      } else if (!user || await hash(body.password, user.salt) !== user.password_hash) {
        fail('Invalid credentials', 401);
      }
      sessionStorage.setItem(SESSION, String(user.id));
      return { user: safeUser(user) };
    }
    if (url === '/auth/logout') { sessionStorage.removeItem(SESSION); return { ok: true }; }
    const user = state.users.find(u => u.id === Number(sessionStorage.getItem(SESSION)));
    if (!user) fail('Not authenticated', 401);
    if (url === '/auth/me') return { user: safeUser(user) };
    if (url === '/auth/users') {
      if (!user.is_admin) fail('Admin only', 403);
      if (method === 'GET') return state.users.map(safeUser);
      if (!body.username || !body.full_name || !body.password) fail('Username, full name and password required');
      if (state.users.some(u => u.username === body.username)) fail('Username already exists', 409);
      const account = { id: state.nextId++, username: body.username, full_name: body.full_name, is_admin: !!body.is_admin, ...await credentials(body.password) };
      state.users.push(account); await write(state); return { id: account.id };
    }
    if (url === '/auth/change-password') {
      if (!body.current || !body.next) fail('Current and new password required');
      if (await hash(body.current, user.salt) !== user.password_hash) fail('Current password is wrong', 401);
      Object.assign(user, await credentials(body.next)); await write(state); return { ok: true };
    }
    if (url === '/ai/status') return { available: false };
    if (url === '/gitlab/status') return { configured: false };
    if (/^\/(ai|gitlab)\//.test(url)) fail('Integrations are disabled in the browser demo.', 503);
    if (url === '/projects') {
      if (method === 'GET') return state.projects.map(p => ({ ...p, owner_name: state.users.find(u => u.id === p.owner_id)?.full_name, task_count: state.tasks.filter(t => t.project_id === p.id).length, member_count: state.members.filter(m => m.project_id === p.id).length, doc_count: state.documents.filter(d => d.project_id === p.id).length })).reverse();
      if (!body.name) fail('Name required');
      const project = { ...projectData(body), id: state.nextId++, owner_id: user.id, progress: 0, created_at: now() };
      state.projects.push(project); await write(state); return { id: project.id };
    }
    const projectMatch = url.match(/^\/projects\/(\d+)$/);
    if (projectMatch) {
      const id = Number(projectMatch[1]); const project = state.projects.find(p => p.id === id);
      if (!project) fail('Project not found', 404);
      if (method === 'GET') return detail(state, project);
      if (method === 'DELETE') {
        state.projects = state.projects.filter(p => p.id !== id);
        for (const table of ['tasks', 'members', 'documents', 'quality']) state[table] = state[table].filter(row => row.project_id !== id);
      } else { if (!body.name) fail('Name required'); Object.assign(project, projectData(body)); }
      await write(state); return { ok: true };
    }
    const childMatch = url.match(/^\/(tasks|members|quality|documents)\/(?:project\/(\d+)|(\d+))$/);
    if (!childMatch) fail('Route not found', 404);
    const [, table, parent, rowId] = childMatch;
    const existing = rowId ? state[table].find(row => row.id === Number(rowId)) : null;
    if (rowId && !existing) fail('Item not found', 404);
    const projectId = existing?.project_id ?? Number(parent);
    if (!state.projects.some(p => p.id === projectId)) fail('Project not found', 404);
    if (method === 'DELETE') {
      state[table] = state[table].filter(row => row.id !== Number(rowId));
      const pct = progress(state, projectId); await write(state); return { ok: true, progress: pct };
    }
    let fields;
    if (table === 'tasks') {
      if (!body.title) fail('Title required');
      fields = { title: body.title, phase: body.phase || 'planning', start_date: body.start_date || null, end_date: body.end_date || null, responsible_team: body.responsible_team || '', status: body.status || 'todo', sort_order: Number(body.sort_order) || 0 };
    } else if (table === 'members') {
      if (!body.name || !body.role) fail('Name and role required');
      fields = { name: body.name, role: body.role, responsibility: body.responsibility || '', reports_to: body.reports_to || '', contact: body.contact || '' };
    } else if (table === 'quality') {
      if (!body.standard) fail('Standard required');
      fields = { standard: body.standard, method: body.method || '', status: body.status || 'pending', notes: body.notes || '' };
    } else {
      const file = body.get('file');
      if (!(file instanceof Blob)) fail('File required');
      if (file.size > 3 * 1024 * 1024) fail('File too large. Maximum size is 3 MB.', 413);
      fields = { file, original_name: file.name, mime_type: file.type, size_bytes: file.size, category: body.get('category') || 'general', uploaded_by: user.id };
    }
    const row = existing || { id: state.nextId++, project_id: projectId, created_at: now() };
    Object.assign(row, fields);
    if (!existing) state[table].push(row);
    const pct = progress(state, projectId); await write(state);
    return existing ? { ok: true, progress: pct } : { id: row.id };
  }
  async function download(id) {
    const state = await read();
    if (!state.users.some(u => u.id === Number(sessionStorage.getItem(SESSION)))) fail('Not authenticated', 401);
    const doc = state.documents.find(d => d.id === Number(id));
    if (!doc) fail('Document not found', 404);
    const url = URL.createObjectURL(doc.file);
    const link = document.createElement('a'); link.href = url; link.download = doc.original_name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return { request, download };
})();
