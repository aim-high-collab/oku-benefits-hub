import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  accessibility TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitter_is_owner INTEGER NOT NULL DEFAULT 0,
  partner_verified INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS places_status ON places(status);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  value_text TEXT NOT NULL DEFAULT '',
  conditions TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS offers_place ON offers(place_id);

CREATE TABLE IF NOT EXISTS benefits (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  agency TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  eligibility TEXT NOT NULL DEFAULT '',
  how_to_apply TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  last_verified TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  access_rating INTEGER CHECK (access_rating BETWEEN 1 AND 5),
  discount_honoured TEXT NOT NULL DEFAULT 'not_tried' CHECK (discount_honoured IN ('yes','no','not_tried')),
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (place_id, user_id)
);

CREATE TABLE IF NOT EXISTS edit_requests (
  id INTEGER PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('place','benefit')),
  target_id INTEGER NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changes TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS edit_requests_status ON edit_requests(status);
`;

export function openDb(file = ':memory:') {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
