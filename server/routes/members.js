import express from 'express';
import { q } from '../db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);
router.use(requirePermission('team:write'));

// Roles, responsibilities & reporting lines (feature 5).
router.post('/project/:projectId', async (req, res) => {
  const { name, role, responsibility, reports_to, contact } = req.body || {};
  if (!name || !role) return res.status(400).json({ error: 'name and role required' });
  const result = await q(
    `INSERT INTO members (project_id, name, role, responsibility, reports_to, contact)
     VALUES (?,?,?,?,?,?)`,
    [req.params.projectId, name, role, responsibility || null, reports_to || null, contact || null]
  );
  res.status(201).json({ id: result.insertId });
});

router.put('/:id', async (req, res) => {
  const { name, role, responsibility, reports_to, contact } = req.body || {};
  await q(
    `UPDATE members SET name=?, role=?, responsibility=?, reports_to=?, contact=? WHERE id=?`,
    [name, role, responsibility || null, reports_to || null, contact || null, req.params.id]
  );
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await q('DELETE FROM members WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
