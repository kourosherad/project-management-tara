import express from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db.js';
import { signToken, requireAuth, requireAdmin } from '../middleware/auth.js';
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
  res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, is_admin: !!user.is_admin } });
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
  const rows = await q('SELECT id, username, full_name, is_admin, created_at FROM users ORDER BY id');
  res.json(rows);
});

// Admin: create a new login account (for your co-worker, etc.)
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const { username, full_name, password, is_admin } = req.body || {};
  if (!username || !full_name || !password) return res.status(400).json({ error: 'username, full_name, password required' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const result = await q(
      'INSERT INTO users (username, full_name, password_hash, is_admin) VALUES (?,?,?,?)',
      [username, full_name, hash, is_admin ? 1 : 0]
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    if (/UNIQUE constraint/i.test(e.message)) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    throw e;
  }
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
