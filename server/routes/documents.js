import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { uploadDir, maxUploadBytes } from '../config.js';
import { q } from '../db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const UPLOAD_DIR = uploadDir;
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
    cb(null, `${randomUUID()}_${safe}`);
  },
});
const upload = multer({ storage, limits: { fileSize: maxUploadBytes, files: 1, fields: 5 } });

const router = express.Router();
router.use(requireAuth);

// Upload a document to a project (feature 2).
router.post('/project/:projectId', requirePermission('document:write'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const { category } = req.body || {};
  const result = await q(
    `INSERT INTO documents (project_id, original_name, stored_name, mime_type, size_bytes, category, uploaded_by)
     VALUES (?,?,?,?,?,?,?)`,
    [req.params.projectId, req.file.originalname, req.file.filename,
     req.file.mimetype, req.file.size, category || 'general', req.user.id]
  );
  res.status(201).json({ id: result.insertId });
});

// Download / view a document.
router.get('/:id/download', async (req, res) => {
  const rows = await q('SELECT * FROM documents WHERE id = ?', [req.params.id]);
  const doc = rows[0];
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(UPLOAD_DIR, doc.stored_name);
  if (!fs.existsSync(filePath)) return res.status(410).json({ error: 'File missing on disk' });
  res.download(filePath, doc.original_name);
});

router.delete('/:id', requirePermission('document:write'), async (req, res) => {
  const rows = await q('SELECT * FROM documents WHERE id = ?', [req.params.id]);
  const doc = rows[0];
  if (doc) {
    const filePath = path.join(UPLOAD_DIR, doc.stored_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await q('DELETE FROM documents WHERE id = ?', [req.params.id]);
  }
  res.json({ ok: true });
});

export default router;
