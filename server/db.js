// Driver-aware data layer.
//   DB_DRIVER=sqlite  (default) -> single local file, zero setup, uses built-in node:sqlite
//   DB_DRIVER=mysql            -> company MySQL server (mysql2)
//
// Both expose the same async `q(sql, params)` which returns:
//   - an array of rows for SELECT
//   - { insertId, affectedRows } for INSERT / UPDATE / DELETE
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();

let runQuery;    // (sql, params) => rows | { insertId, affectedRows }
let applySchema; // () => Promise<void>

if (driver === 'mysql') {
  const mysql = (await import('mysql2/promise')).default;
  const cfg = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tara_pm',
    dateStrings: true,
  };
  const pool = mysql.createPool({ ...cfg, waitForConnections: true, connectionLimit: 10 });
  runQuery = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows; // mysql2 returns OkPacket (with insertId) for writes, array for reads
  };
  applySchema = async () => {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const conn = await mysql.createConnection({ ...cfg, database: undefined, multipleStatements: true });
    await conn.query(schema);
    await conn.end();
  };
} else {
  // ----- SQLite (built-in, no native dependency) -----
  const { DatabaseSync } = await import('node:sqlite');
  const file = process.env.SQLITE_FILE || path.join(__dirname, '..', 'data.db');
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  console.log(`Using SQLite database at ${file}`);

  runQuery = async (sql, params = []) => {
    const stmt = db.prepare(sql);
    if (/^\s*select/i.test(sql)) return stmt.all(...params);
    const info = stmt.run(...params);
    return { insertId: Number(info.lastInsertRowid), affectedRows: info.changes };
  };
  applySchema = async () => {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sqlite.sql'), 'utf8');
    db.exec(schema);
  };
}

export async function q(sql, params = []) {
  return runQuery(sql, params);
}

// Create tables if missing and seed a default admin. Safe to run on every boot.
export async function ensureReady() {
  await applySchema();
  const rows = await q('SELECT COUNT(*) AS c FROM users');
  if (Number(rows[0].c) === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await q(
      'INSERT INTO users (username, full_name, password_hash, is_admin) VALUES (?,?,?,1)',
      ['admin', 'Administrator', hash]
    );
    console.log('Seeded default admin user  ->  username: admin   password: admin123');
  }
}
