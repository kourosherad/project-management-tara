import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Shared connection pool. Used by every route.
export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tara_pm',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true, // return DATE/DATETIME as strings so JSON is clean
});

// Small helper so routes can run `const rows = await q('SELECT ...', [params])`.
export async function q(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
