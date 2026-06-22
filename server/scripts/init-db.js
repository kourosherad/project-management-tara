// Creates the database + tables and seeds an initial admin user.
// Usage:  npm run init-db
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const cfg = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  };

  console.log(`Connecting to MySQL at ${cfg.host}:${cfg.port} as ${cfg.user} ...`);
  const conn = await mysql.createConnection(cfg);

  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  console.log('Applying schema.sql ...');
  await conn.query(schema);

  // Seed a default admin account (only if no users exist).
  const dbName = process.env.DB_NAME || 'tara_pm';
  await conn.query(`USE \`${dbName}\``);
  const [users] = await conn.query('SELECT COUNT(*) AS c FROM users');
  if (users[0].c === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await conn.query(
      'INSERT INTO users (username, full_name, password_hash, is_admin) VALUES (?,?,?,1)',
      ['admin', 'Administrator', hash]
    );
    console.log('Seeded admin user  ->  username: admin   password: admin123');
    console.log('** Change this password after first login. **');
  } else {
    console.log('Users already exist; skipping admin seed.');
  }

  await conn.end();
  console.log('Database ready.');
}

main().catch((err) => {
  console.error('init-db failed:', err.message);
  process.exit(1);
});
