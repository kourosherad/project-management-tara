import express from 'express';
import { q } from '../db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

// Recompute a project's progress from its tasks (done / total).
async function recomputeProgress(projectId) {
  const rows = await q(
    "SELECT COUNT(*) AS total, SUM(status='done') AS done FROM tasks WHERE project_id = ?",
    [projectId]
  );
  const { total, done } = rows[0];
  const progress = total > 0 ? Math.round((Number(done) / Number(total)) * 100) : 0;
  await q('UPDATE projects SET progress = ? WHERE id = ?', [progress, projectId]);
  return progress;
}
export { recomputeProgress };

// List all projects with owner name + quick counts.
router.get('/', async (req, res) => {
  const rows = await q(`
    SELECT p.*, u.full_name AS owner_name,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
      (SELECT COUNT(*) FROM members m WHERE m.project_id = p.id) AS member_count,
      (SELECT COUNT(*) FROM documents d WHERE d.project_id = p.id) AS doc_count
    FROM projects p
    LEFT JOIN users u ON u.id = p.owner_id
    ORDER BY p.created_at DESC
  `);
  res.json(rows);
});

// Single project with all related data.
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  const rows = await q('SELECT * FROM projects WHERE id = ?', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
  const project = rows[0];
  project.tasks = await q('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order, start_date', [id]);
  project.members = await q('SELECT * FROM members WHERE project_id = ? ORDER BY id', [id]);
  project.documents = await q('SELECT * FROM documents WHERE project_id = ? ORDER BY created_at DESC', [id]);
  project.quality = await q('SELECT * FROM quality_items WHERE project_id = ? ORDER BY id', [id]);
  res.json(project);
});

router.post('/', requirePermission('project:create'), async (req, res) => {
  const { name, description, project_type, status, start_date, due_date, gitlab_project_id } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const result = await q(
    `INSERT INTO projects (name, description, project_type, status, start_date, due_date, gitlab_project_id, owner_id)
     VALUES (?,?,?,?,?,?,?,?)`,
    [name, description || null, project_type || 'web', status || 'planning',
     start_date || null, due_date || null, gitlab_project_id || null, req.user.id]
  );
  res.status(201).json({ id: result.insertId });
});

router.put('/:id', requirePermission('project:edit'), async (req, res) => {
  const { name, description, project_type, status, start_date, due_date, gitlab_project_id } = req.body || {};
  await q(
    `UPDATE projects SET name=?, description=?, project_type=?, status=?, start_date=?, due_date=?, gitlab_project_id=?
     WHERE id=?`,
    [name, description || null, project_type || 'web', status || 'planning',
     start_date || null, due_date || null, gitlab_project_id || null, req.params.id]
  );
  res.json({ ok: true });
});

router.delete('/:id', requirePermission('project:delete'), async (req, res) => {
  await q('DELETE FROM projects WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
