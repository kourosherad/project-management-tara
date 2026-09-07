import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config.js';

const SECRET = jwtSecret;

export function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, is_admin: !!user.is_admin, full_name: user.full_name },
    SECRET,
    { expiresIn: '7d' }
  );
}

// Reads the token from the httpOnly cookie OR the Authorization header.
export function requireAuth(req, res, next) {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = req.cookies?.token || bearer;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin only' });
  next();
}
