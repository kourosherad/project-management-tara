import express from 'express';
import { q } from '../db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { runClaude, runClaudeJSON } from '../services/claude.js';

const router = express.Router();
router.use(requireAuth);

// Quick health check that the local Claude CLI responds.
router.get('/status', async (req, res) => {
  try {
    const out = await runClaude('Reply with exactly: OK', { timeoutMs: 30000 });
    res.json({ available: /ok/i.test(out), sample: out.slice(0, 80) });
  } catch (e) {
    res.json({ available: false, error: e.message });
  }
});

async function loadProject(id) {
  const rows = await q('SELECT * FROM projects WHERE id = ?', [id]);
  return rows[0] || null;
}

/**
 * Feature 7: generate a phased project timeline.
 * Claude returns task rows; we insert them and return the saved list.
 */
router.post('/project/:id/timeline', requirePermission('ai:generate'), async (req, res, next) => {
  try {
    const project = await loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const domain = req.body?.domain || 'software development';

    const prompt =
`You are an experienced project manager. Build a detailed project timeline for this ${domain} project.
Project name: ${project.name}
Description: ${project.description || '(none)'}
Type: ${project.project_type}
Start date: ${project.start_date || 'choose a sensible start'}
Due date: ${project.due_date || 'estimate based on scope'}

Break it into the phases: planning, execution, testing, delivery.
For each task give: title, phase (one of planning|execution|testing|delivery),
start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), responsible_team.
Return a JSON array of 8-16 task objects with exactly those keys.`;

    const tasks = await runClaudeJSON(prompt);
    if (!Array.isArray(tasks)) return res.status(502).json({ error: 'AI did not return a task list' });

    let order = 0;
    const inserted = [];
    for (const t of tasks) {
      const result = await q(
        `INSERT INTO tasks (project_id, title, phase, start_date, end_date, responsible_team, status, sort_order)
         VALUES (?,?,?,?,?,?, 'todo', ?)`,
        [project.id, String(t.title || 'Untitled').slice(0, 220),
         normPhase(t.phase), t.start_date || null, t.end_date || null,
         t.responsible_team || null, order++]
      );
      inserted.push(result.insertId);
    }
    res.json({ created: inserted.length });
  } catch (e) { next(e); }
});

/**
 * Feature 8: analyze resource requirements (human / materials / technology).
 * Returns markdown text shown in the UI (not stored).
 */
router.post('/project/:id/resources', requirePermission('ai:generate'), async (req, res, next) => {
  try {
    const project = await loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const prompt =
`Act as a project manager. Analyze the resource requirements for this ${project.project_type} project.
Project: ${project.name}
Description: ${project.description || '(none)'}

Break the needs down by phase (initiation, planning, execution, closing). For each phase include:
- Human resources (roles and skills required)
- Materials
- Technology
Finish with an estimated allocation strategy to balance workloads.
Format the answer as clean Markdown with headings and tables.`;

    const text = await runClaude(prompt);
    res.json({ markdown: text });
  } catch (e) { next(e); }
});

/**
 * Feature 6 helper: generate a quality management checklist and store the items.
 */
router.post('/project/:id/quality', requirePermission('ai:generate'), async (req, res, next) => {
  try {
    const project = await loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const prompt =
`Act as a QA lead. Produce a quality management plan checklist for this ${project.project_type} software project: ${project.name}.
Description: ${project.description || '(none)'}
Return a JSON array of 6-12 objects, each with: standard (the quality criterion),
method (how it is verified: review/test/audit). Keep each field short.`;

    const items = await runClaudeJSON(prompt);
    if (!Array.isArray(items)) return res.status(502).json({ error: 'AI did not return a checklist' });

    const inserted = [];
    for (const it of items) {
      const result = await q(
        `INSERT INTO quality_items (project_id, standard, method, status) VALUES (?,?,?, 'pending')`,
        [project.id, String(it.standard || '').slice(0, 220), it.method || null]
      );
      inserted.push(result.insertId);
    }
    res.json({ created: inserted.length });
  } catch (e) { next(e); }
});

// Free-form assistant: ask anything about a project; returns markdown.
router.post('/project/:id/ask', requirePermission('ai:generate'), async (req, res, next) => {
  try {
    const project = await loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const question = req.body?.question;
    if (!question) return res.status(400).json({ error: 'question required' });

    const tasks = await q('SELECT title, phase, status FROM tasks WHERE project_id = ?', [project.id]);
    const members = await q('SELECT name, role FROM members WHERE project_id = ?', [project.id]);
    const ctx = `Project: ${project.name} (${project.project_type}, status ${project.status}, ${project.progress}% done)
Description: ${project.description || '(none)'}
Tasks: ${tasks.map((t) => `${t.title} [${t.phase}/${t.status}]`).join('; ') || 'none'}
Team: ${members.map((m) => `${m.name} (${m.role})`).join('; ') || 'none'}`;

    const text = await runClaude(`${ctx}\n\nQuestion from the project manager: ${question}\n\nAnswer in concise Markdown.`);
    res.json({ markdown: text });
  } catch (e) { next(e); }
});

function normPhase(p) {
  const v = String(p || '').toLowerCase();
  return ['planning', 'execution', 'testing', 'delivery'].includes(v) ? v : 'planning';
}

export default router;
