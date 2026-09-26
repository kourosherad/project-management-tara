import express from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db.js';
import { signToken, requireAuth, requireAdmin, roles } from '../middleware/auth.js';
import { onVercel } from '../config.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const rows = await q('SELECT * FROM users WHERE username = ?', [username]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken(user);
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: onVercel,
    maxAge: 7 * 24 * 3600 * 1000,
  });
  res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, is_admin: user.role === 'admin' } });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: onVercel });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Admin: list users
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  const rows = await q('SELECT id, username, full_name, role, created_at FROM users ORDER BY id');
  res.json(rows);
});

// Admin: create a new login account (for your co-worker, etc.)
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const { username, full_name, password, role = 'viewer' } = req.body || {};
  if (!username || !full_name || !password) return res.status(400).json({ error: 'username, full_name, password required' });
  if (!roles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const result = await q(
      'INSERT INTO users (username, full_name, password_hash, is_admin, role) VALUES (?,?,?,?,?)',
      [username, full_name, hash, role === 'admin' ? 1 : 0, role]
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    if (/UNIQUE constraint/i.test(e.message)) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    throw e;
  }
});

router.put('/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  const { role } = req.body || {};
  if (!roles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const rows = await q('SELECT id, role FROM users WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  if (rows[0].role === 'admin' && role !== 'admin') {
    const admins = await q("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
    if (Number(admins[0].c) <= 1) return res.status(409).json({ error: 'At least one admin is required' });
  }
  await q('UPDATE users SET role = ?, is_admin = ? WHERE id = ?', [role, role === 'admin' ? 1 : 0, req.params.id]);
  res.json({ ok: true });
});

// Change own password
router.post('/change-password', requireAuth, async (req, res) => {
  const { current, next } = req.body || {};
  if (!current || !next) return res.status(400).json({ error: 'current and next required' });
  const rows = await q('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(current, user.password_hash))) {
    return res.status(401).json({ error: 'Current password is wrong' });
  }
  const hash = await bcrypt.hash(next, 10);
  await q('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  res.json({ ok: true });
});

export default router;
