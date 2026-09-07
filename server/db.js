// SQLite only. Vercel demo storage is temporary and local to each function instance.
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { databaseFile, adminUsername, adminPassword } from './config.js';

export const driver = 'sqlite';
fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
const db = new DatabaseSync(databaseFile);
db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

export async function q(sql, params = []) {
  const stmt = db.prepare(sql);
  if (/^\s*select/i.test(sql)) return stmt.all(...params);
  const info = stmt.run(...params);
  return { insertId: Number(info.lastInsertRowid), affectedRows: Number(info.changes) };
}

let ready;
export function ensureReady() {
  // Share initialization between concurrent requests on a cold start.
  ready ??= initialize().catch((error) => { ready = undefined; throw error; });
  return ready;
}
async function initialize() {
  db.exec(fs.readFileSync(new URL('./schema.sqlite.sql', import.meta.url), 'utf8'));
  const rows = await q('SELECT COUNT(*) AS c FROM users');
  if (Number(rows[0].c) === 0) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await q(
      'INSERT OR IGNORE INTO users (username, full_name, password_hash, is_admin) VALUES (?,?,?,1)',
      [adminUsername, 'Administrator', hash]
    );
    console.log('Initialized administrator account.');
  }
}
