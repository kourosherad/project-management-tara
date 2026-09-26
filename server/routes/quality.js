import express from 'express';
import { q } from '../db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);
router.use(requirePermission('quality:write'));

// Quality management plan items (feature 6).
router.post('/project/:projectId', async (req, res) => {
  const { standard, method, status, notes } = req.body || {};
  if (!standard) return res.status(400).json({ error: 'standard required' });
  const result = await q(
    `INSERT INTO quality_items (project_id, standard, method, status, notes) VALUES (?,?,?,?,?)`,
    [req.params.projectId, standard, method || null, status || 'pending', notes || null]
  );
  res.status(201).json({ id: result.insertId });
});

router.put('/:id', async (req, res) => {
  const { standard, method, status, notes } = req.body || {};
  await q(
    `UPDATE quality_items SET standard=?, method=?, status=?, notes=? WHERE id=?`,
    [standard, method || null, status || 'pending', notes || null, req.params.id]
  );
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await q('DELETE FROM quality_items WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
