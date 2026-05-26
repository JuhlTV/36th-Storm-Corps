const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'portal.sqlite');

let database;

const getDatabase = () => {
  if (!database) {
    fs.mkdirSync(dataDir, { recursive: true });
    database = new Database(dbPath);
    database.pragma('journal_mode = WAL');
  }

  return database;
};

const initDb = () => {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_sub TEXT UNIQUE NOT NULL,
      username TEXT,
      email TEXT UNIQUE,
      auth_provider TEXT NOT NULL DEFAULT 'google',
      password_hash TEXT,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      first_ip TEXT,
      last_ip TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS forum_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      author_user_id INTEGER NOT NULL,
      locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (author_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS forum_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      author_user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (thread_id) REFERENCES forum_threads(id),
      FOREIGN KEY (author_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (actor_user_id) REFERENCES users(id)
    );
  `);

  const userColumns = db.prepare('PRAGMA table_info(users)').all().map((entry) => entry.name);

  if (!userColumns.includes('username')) {
    db.exec('ALTER TABLE users ADD COLUMN username TEXT');
  }

  if (!userColumns.includes('auth_provider')) {
    db.exec("ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'google'");
  }

  if (!userColumns.includes('password_hash')) {
    db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
  }

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username) WHERE username IS NOT NULL');
  db.exec("UPDATE users SET auth_provider = COALESCE(auth_provider, 'google')");

  return db;
};

const nowIso = () => new Date().toISOString();

const normalizeRole = (role) => {
  const allowed = new Set(['owner', 'admin', 'moderator', 'member']);
  return allowed.has(role) ? role : 'member';
};

const findUserByGoogleSub = (googleSub) => {
  const db = getDatabase();
  return db.prepare('SELECT * FROM users WHERE google_sub = ?').get(googleSub);
};

const findUserByEmail = (email) => {
  if (!email) {
    return null;
  }

  const db = getDatabase();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
};

const findUserByUsername = (username) => {
  if (!username) {
    return null;
  }

  const db = getDatabase();
  return db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim().toLowerCase());
};

const findUserByLogin = (login) => {
  const normalized = String(login || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return findUserByUsername(normalized) || findUserByEmail(normalized);
};

const countUsers = () => {
  const db = getDatabase();
  const result = db.prepare('SELECT COUNT(*) as total FROM users').get();
  return Number(result?.total || 0);
};

const createLocalUser = ({ username, email = null, passwordHash, displayName, ipAddress, defaultRole = 'member' }) => {
  const db = getDatabase();
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
  const timestamp = nowIso();

  const result = db.prepare(`
    INSERT INTO users (
      google_sub, username, email, auth_provider, password_hash,
      display_name, avatar_url, role, first_ip, last_ip, created_at, updated_at, last_login_at
    ) VALUES (?, ?, ?, 'local', ?, ?, NULL, ?, ?, ?, ?, ?, ?)
  `).run(
    `local:${normalizedUsername}`,
    normalizedUsername,
    normalizedEmail,
    passwordHash,
    displayName,
    normalizeRole(defaultRole),
    ipAddress,
    ipAddress,
    timestamp,
    timestamp,
    timestamp,
  );

  return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
};

const upsertUserFromGoogle = ({ profile, ipAddress, defaultRole = 'member' }) => {
  const db = getDatabase();
  const googleSub = String(profile.id);
  const email = profile.emails?.[0]?.value?.toLowerCase?.() ?? null;
  const displayName = profile.displayName || email || 'Unbekannt';
  const avatarUrl = profile.photos?.[0]?.value ?? null;
  const timestamp = nowIso();

  let existing = findUserByGoogleSub(googleSub) || findUserByEmail(email);

  if (!existing) {
    const insert = db.prepare(`
      INSERT INTO users (
        google_sub, username, email, auth_provider, password_hash, display_name, avatar_url, role,
        first_ip, last_ip, created_at, updated_at, last_login_at
      ) VALUES (?, NULL, ?, 'google', NULL, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      googleSub,
      email,
      displayName,
      avatarUrl,
      normalizeRole(defaultRole),
      ipAddress,
      ipAddress,
      timestamp,
      timestamp,
      timestamp,
    );

    existing = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    return existing;
  }

  const nextRole = existing.role === 'owner' ? 'owner' : normalizeRole(defaultRole);
  const firstIp = existing.first_ip || ipAddress;

  db.prepare(`
    UPDATE users
    SET email = ?, auth_provider = 'google', display_name = ?, avatar_url = ?, role = ?, first_ip = ?, last_ip = ?, updated_at = ?, last_login_at = ?
    WHERE id = ?
  `).run(
    email || existing.email,
    displayName,
    avatarUrl,
    nextRole,
    firstIp,
    ipAddress,
    timestamp,
    timestamp,
    existing.id,
  );

  return db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
};

const touchUserLogin = ({ userId, ipAddress }) => {
  const db = getDatabase();
  const timestamp = nowIso();
  db.prepare(`
    UPDATE users
    SET last_ip = ?, updated_at = ?, last_login_at = ?
    WHERE id = ?
  `).run(ipAddress, timestamp, timestamp, userId);

  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
};

const setUserRole = ({ userId, role }) => {
  const db = getDatabase();
  const timestamp = nowIso();
  db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(normalizeRole(role), timestamp, userId);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
};

const listUsers = () => {
  const db = getDatabase();
  return db.prepare('SELECT id, username, email, auth_provider, display_name, avatar_url, role, first_ip, last_ip, created_at, updated_at, last_login_at FROM users ORDER BY created_at DESC').all();
};

const createThread = ({ title, body, authorUserId }) => {
  const db = getDatabase();
  const timestamp = nowIso();
  const result = db.prepare(`
    INSERT INTO forum_threads (title, body, author_user_id, locked, created_at, updated_at)
    VALUES (?, ?, ?, 0, ?, ?)
  `).run(title, body, authorUserId, timestamp, timestamp);

  return db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(result.lastInsertRowid);
};

const listThreads = () => {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      t.id, t.title, t.body, t.locked, t.created_at, t.updated_at,
      u.display_name AS author_name,
      u.role AS author_role,
      (SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id = t.id) AS reply_count
    FROM forum_threads t
    JOIN users u ON u.id = t.author_user_id
    ORDER BY t.updated_at DESC, t.created_at DESC
  `).all();
};

const getThreadById = (threadId) => {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      t.id, t.title, t.body, t.locked, t.created_at, t.updated_at,
      u.display_name AS author_name,
      u.role AS author_role
    FROM forum_threads t
    JOIN users u ON u.id = t.author_user_id
    WHERE t.id = ?
  `).get(threadId);
};

const listPostsForThread = (threadId) => {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      p.id, p.body, p.created_at,
      u.display_name AS author_name,
      u.role AS author_role,
      u.avatar_url
    FROM forum_posts p
    JOIN users u ON u.id = p.author_user_id
    WHERE p.thread_id = ?
    ORDER BY p.created_at ASC
  `).all(threadId);
};

const createPost = ({ threadId, authorUserId, body }) => {
  const db = getDatabase();
  const timestamp = nowIso();
  const result = db.prepare(`
    INSERT INTO forum_posts (thread_id, author_user_id, body, created_at)
    VALUES (?, ?, ?, ?)
  `).run(threadId, authorUserId, body, timestamp);

  db.prepare('UPDATE forum_threads SET updated_at = ? WHERE id = ?').run(timestamp, threadId);
  return db.prepare('SELECT * FROM forum_posts WHERE id = ?').get(result.lastInsertRowid);
};

const setThreadLocked = ({ threadId, locked }) => {
  const db = getDatabase();
  const timestamp = nowIso();
  db.prepare('UPDATE forum_threads SET locked = ?, updated_at = ? WHERE id = ?').run(locked ? 1 : 0, timestamp, threadId);
  return getThreadById(threadId);
};

const recordAuditEvent = ({ actorUserId = null, eventType, payload }) => {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO audit_events (actor_user_id, event_type, payload, created_at)
    VALUES (?, ?, ?, ?)
  `).run(actorUserId, eventType, JSON.stringify(payload ?? {}), nowIso());
};

module.exports = {
  initDb,
  getDatabase,
  countUsers,
  createLocalUser,
  findUserByLogin,
  findUserByUsername,
  upsertUserFromGoogle,
  findUserByGoogleSub,
  findUserByEmail,
  touchUserLogin,
  listUsers,
  setUserRole,
  createThread,
  listThreads,
  getThreadById,
  listPostsForThread,
  createPost,
  setThreadLocked,
  recordAuditEvent,
};
