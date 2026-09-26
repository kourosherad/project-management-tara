import jwt from 'jsonwebtoken';
import { q } from '../db.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(user) {
  return jwt.sign(
    { id: user.id },
    SECRET,
    { expiresIn: '7d' }
  );
}

// Reads the token from the httpOnly cookie OR the Authorization header.
export async function requireAuth(req, res, next) {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = req.cookies?.token || bearer;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const claims = jwt.verify(token, SECRET);
    const rows = await q('SELECT id, username, full_name, is_admin, role FROM users WHERE id = ?', [claims.id]);
    if (!rows[0]) return res.status(401).json({ error: 'Account no longer exists' });
    req.user = { ...rows[0], is_admin: rows[0].role === 'admin' };
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    next(err);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

export const roles = ['admin', 'manager', 'contributor', 'viewer'];

const permissions = {
  admin: ['project:create', 'project:edit', 'project:delete', 'work:write', 'team:write', 'document:write', 'quality:write', 'ai:generate'],
  manager: ['project:create', 'project:edit', 'work:write', 'team:write', 'document:write', 'quality:write', 'ai:generate'],
  contributor: ['work:write', 'document:write', 'quality:write'],
  viewer: [],
};

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!permissions[req.user?.role]?.includes(permission)) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    next();
  };
}
