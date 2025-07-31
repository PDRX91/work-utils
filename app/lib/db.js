import path from "path";
import { promises as fs } from "fs";

let db = null;

export async function getDb() {
  if (db) return db;

  // Ensure data directory exists
  const dataDir = path.join(process.cwd(), "data");
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "auth.db");

  // Dynamic imports to avoid issues with Next.js
  const sqlite3 = (await import("sqlite3")).default;
  const { open } = await import("sqlite");

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Create tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  return db;
}

export async function closeDb() {
  if (db) {
    await db.close();
    db = null;
  }
}
