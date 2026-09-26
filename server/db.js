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
import { migrations } from './migrations.js';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();

let runQuery;    // (sql, params) => rows | { insertId, affectedRows }
let applySchema; // () => Promise<void>
let applyMigrations;

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
  applyMigrations = async () => {
    const conn = await pool.getConnection();
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        version INT PRIMARY KEY, name VARCHAR(160) NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      const [applied] = await conn.query('SELECT version FROM schema_migrations');
      const known = new Set(applied.map((row) => Number(row.version)));
      for (const migration of migrations) {
        if (known.has(migration.version)) continue;
        // MySQL DDL commits implicitly; record success only after every statement.
        for (const sql of migration.mysql) {
          try { await conn.query(sql); }
          catch (err) {
            // A prior interrupted run may have added the role column before
            // its version row was recorded. The following UPDATE is rerunnable.
            if (!(migration.version === 2 && err.code === 'ER_DUP_FIELDNAME')) throw err;
          }
        }
        await conn.execute('INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
          [migration.version, migration.name]);
      }
    } finally { conn.release(); }
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
  applyMigrations = async () => {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY, name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')))`);
    const known = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((row) => row.version));
    for (const migration of migrations) {
      if (known.has(migration.version)) continue;
      db.exec('BEGIN');
      try {
        for (const sql of migration.sqlite) db.exec(sql);
        db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(migration.version, migration.name);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    }
  };
}

export async function q(sql, params = []) {
  return runQuery(sql, params);
}

// Create tables if missing and seed a default admin. Safe to run on every boot.
export async function ensureReady() {
  await applySchema();
  await applyMigrations();
  const rows = await q('SELECT COUNT(*) AS c FROM users');
  if (Number(rows[0].c) === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await q(
      "INSERT INTO users (username, full_name, password_hash, is_admin, role) VALUES (?,?,?,1,'admin')",
      ['admin', 'Administrator', hash]
    );
    console.log('Seeded default admin user  ->  username: admin   password: admin123');
  }
}
