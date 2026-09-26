import express from 'express';
import { q } from '../db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { recomputeProgress } from './projects.js';

const router = express.Router();
router.use(requireAuth);
router.use(requirePermission('work:write'));

// Timeline tasks/phases (features 4 & 7).
router.post('/project/:projectId', async (req, res) => {
  const { title, phase, start_date, end_date, responsible_team, status, sort_order } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });
  const result = await q(
    `INSERT INTO tasks (project_id, title, phase, start_date, end_date, responsible_team, status, sort_order)
     VALUES (?,?,?,?,?,?,?,?)`,
    [req.params.projectId, title, phase || 'planning', start_date || null, end_date || null,
     responsible_team || null, status || 'todo', sort_order || 0]
  );
  await recomputeProgress(req.params.projectId);
  res.status(201).json({ id: result.insertId });
});

router.put('/:id', async (req, res) => {
  const { title, phase, start_date, end_date, responsible_team, status, sort_order } = req.body || {};
  const rows = await q('SELECT project_id FROM tasks WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
  await q(
    `UPDATE tasks SET title=?, phase=?, start_date=?, end_date=?, responsible_team=?, status=?, sort_order=? WHERE id=?`,
    [title, phase || 'planning', start_date || null, end_date || null,
     responsible_team || null, status || 'todo', sort_order || 0, req.params.id]
  );
  const progress = await recomputeProgress(rows[0].project_id);
  res.json({ ok: true, progress });
});

router.delete('/:id', async (req, res) => {
  const rows = await q('SELECT project_id FROM tasks WHERE id = ?', [req.params.id]);
  await q('DELETE FROM tasks WHERE id = ?', [req.params.id]);
  if (rows[0]) await recomputeProgress(rows[0].project_id);
  res.json({ ok: true });
});

export default router;
