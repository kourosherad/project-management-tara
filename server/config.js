import dotenv from 'dotenv';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(rootDir, 'server', '.env') });
dotenv.config({ path: path.join(rootDir, '.env') });
export const onVercel = Boolean(process.env.VERCEL);
export const demoMode = process.env.TARA_DEMO === 'true';
if (onVercel && !demoMode) {
  throw new Error('Vercel requires TARA_DEMO=true. Persistent hosting is not configured.');
}
export const dataDir = demoMode ? path.join(os.tmpdir(), 'tara-demo') : rootDir;
export const databaseFile = process.env.SQLITE_FILE || path.join(dataDir, 'data.db');
export const uploadDir = process.env.UPLOAD_DIR || path.join(dataDir, 'uploads');
export const maxUploadBytes = (demoMode ? 3 : 50) * 1024 * 1024;
export const adminUsername = process.env.ADMIN_USERNAME || 'admin';
export const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
export const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';
if (onVercel && (jwtSecret.length < 32 || jwtSecret === 'change-me-to-a-long-random-string')) {
  throw new Error('Set JWT_SECRET to a random secret of at least 32 characters in Vercel.');
}
if (onVercel && (adminPassword.length < 12 || adminPassword === 'admin123')) {
  throw new Error('Set ADMIN_PASSWORD to a unique password of at least 12 characters in Vercel.');
}
