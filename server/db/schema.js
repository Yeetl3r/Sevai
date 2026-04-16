import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../sevai_scout.db');

const db = new Database(DB_PATH);

export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      phone TEXT PRIMARY KEY,
      language TEXT DEFAULT 'ta',
      name TEXT,
      age INTEGER,
      gender TEXT,
      occupation TEXT,
      district TEXT,
      annual_income INTEGER,
      caste TEXT,
      onboarding_complete BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      phone TEXT PRIMARY KEY,
      current_step TEXT,
      data_json TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_phone TEXT,
      scheme_id TEXT,
      status TEXT DEFAULT 'pending',
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_phone) REFERENCES users(phone)
    );
  `);
  console.log('✓ Database initialized at', DB_PATH);
}

export default db;
