import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'nous.db');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Cria o schema caso ainda nao exista. Idempotente.
 */
export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('rt','cozinha','gestor')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      published INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prep TEXT NOT NULL,
      cat TEXT,
      ingredients TEXT NOT NULL,
      yield TEXT NOT NULL,
      cost REAL NOT NULL DEFAULT 0,
      method TEXT NOT NULL,
      rev TEXT,
      obs TEXT
    );

    CREATE TABLE IF NOT EXISTS production (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      prep TEXT NOT NULL,
      qty REAL NOT NULL DEFAULT 0,
      UNIQUE(date, prep)
    );

    CREATE TABLE IF NOT EXISTS docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      expiry TEXT,
      filename TEXT,
      stored_name TEXT,
      mime TEXT,
      size INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      job TEXT NOT NULL,
      admission TEXT,
      course INTEGER NOT NULL DEFAULT 0,
      course_expiry TEXT,
      health INTEGER NOT NULL DEFAULT 0,
      health_expiry TEXT
    );

    CREATE TABLE IF NOT EXISTS temps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dt TEXT NOT NULL,
      type TEXT NOT NULL,
      place TEXT NOT NULL,
      value REAL NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      prep TEXT NOT NULL,
      time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fixed_costs (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      labor REAL NOT NULL DEFAULT 0,
      rent REAL NOT NULL DEFAULT 0,
      utilities REAL NOT NULL DEFAULT 0,
      taxes REAL NOT NULL DEFAULT 0,
      other REAL NOT NULL DEFAULT 0,
      days INTEGER NOT NULL DEFAULT 26
    );

    CREATE TABLE IF NOT EXISTS daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      clients INTEGER NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0,
      other_revenue REAL NOT NULL DEFAULT 0,
      food REAL
    );
  `);
}

migrate();
