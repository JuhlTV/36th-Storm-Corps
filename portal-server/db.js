const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(process.env.PORTAL_DATA_DIR || path.join(__dirname, 'data'));
const storePath = path.join(dataDir, 'portal-data.json');

const nowIso = () => new Date().toISOString();

const normalizeRole = (role) => {
  const allowed = new Set(['owner', 'admin', 'moderator', 'member']);
  return allowed.has(role) ? role : 'member';
};

const createDefaultStore = () => ({
  counters: {
    users: 0,
    threads: 0,
    posts: 0,
    auditEvents: 0,
  },
  users: [],
  forumThreads: [],
  forumPosts: [],
  auditEvents: [],
});

const ensureStoreExists = () => {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(createDefaultStore(), null, 2));
  }
};

const readStore = () => {
  ensureStoreExists();
  const raw = fs.readFileSync(storePath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return createDefaultStore();
    }

    return {
      counters: parsed.counters || createDefaultStore().counters,
      users: Array.isArray(parsed.users) ? parsed.users : [],
      forumThreads: Array.isArray(parsed.forumThreads) ? parsed.forumThreads : [],
      forumPosts: Array.isArray(parsed.forumPosts) ? parsed.forumPosts : [],
      auditEvents: Array.isArray(parsed.auditEvents) ? parsed.auditEvents : [],
    };
  } catch {
    return createDefaultStore();
  }
};

const writeStore = (store) => {
  ensureStoreExists();
  const tmpPath = `${storePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2));
  fs.renameSync(tmpPath, storePath);
};

const withStore = (handler) => {
  const store = readStore();
  const result = handler(store);
  writeStore(store);
  return result;
};

const initDb = () => {
  ensureStoreExists();
  return { mode: 'file-store', path: storePath };
};

const getDatabase = () => ({ mode: 'file-store', path: storePath });

const findUserByGoogleSub = (googleSub) => {
  const store = readStore();
  return store.users.find((entry) => entry.google_sub === googleSub) || null;
};

const findUserById = (userId) => {
  const store = readStore();
  return store.users.find((entry) => entry.id === userId) || null;
};

const findUserByEmail = (email) => {
  if (!email) {
    return null;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const store = readStore();
  return store.users.find((entry) => entry.email === normalizedEmail) || null;
};

const findUserByUsername = (username) => {
  if (!username) {
    return null;
  }

  const normalizedUsername = String(username).trim().toLowerCase();
  const store = readStore();
  return store.users.find((entry) => entry.username === normalizedUsername) || null;
};

const findUserByLogin = (login) => {
  const normalized = String(login || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return findUserByUsername(normalized) || findUserByEmail(normalized);
};

const countUsers = () => {
  const store = readStore();
  return store.users.length;
};

const createLocalUser = ({ username, email = null, passwordHash, displayName, ipAddress, defaultRole = 'member' }) => {
  return withStore((store) => {
    const normalizedUsername = username ? String(username).trim().toLowerCase() : null;
    const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
    const timestamp = nowIso();

    store.counters.users += 1;
    const user = {
      id: store.counters.users,
      google_sub: normalizedUsername ? `local:${normalizedUsername}` : `local:${timestamp}:${Math.random().toString(36).slice(2, 10)}`,
      username: normalizedUsername,
      email: normalizedEmail,
      auth_provider: 'local',
      password_hash: passwordHash || null,
      display_name: displayName,
      avatar_url: null,
      role: normalizeRole(defaultRole),
      first_ip: ipAddress || null,
      last_ip: ipAddress || null,
      created_at: timestamp,
      updated_at: timestamp,
      last_login_at: timestamp,
    };

    store.users.push(user);
    return user;
  });
};

const upsertUserFromGoogle = ({ profile, ipAddress, defaultRole = 'member' }) => {
  return withStore((store) => {
    const googleSub = String(profile.id);
    const email = profile.emails?.[0]?.value?.toLowerCase?.() ?? null;
    const displayName = profile.displayName || email || 'Unbekannt';
    const avatarUrl = profile.photos?.[0]?.value ?? null;
    const timestamp = nowIso();

    let existing = store.users.find((entry) => entry.google_sub === googleSub)
      || (email ? store.users.find((entry) => entry.email === email) : null);

    if (!existing) {
      store.counters.users += 1;
      const user = {
        id: store.counters.users,
        google_sub: googleSub,
        username: null,
        email,
        auth_provider: 'google',
        password_hash: null,
        display_name: displayName,
        avatar_url: avatarUrl,
        role: normalizeRole(defaultRole),
        first_ip: ipAddress || null,
        last_ip: ipAddress || null,
        created_at: timestamp,
        updated_at: timestamp,
        last_login_at: timestamp,
      };

      store.users.push(user);
      return user;
    }

    existing.email = email || existing.email;
    existing.auth_provider = 'google';
    existing.display_name = displayName;
    existing.avatar_url = avatarUrl;
    existing.role = existing.role === 'owner' ? 'owner' : normalizeRole(defaultRole);
    existing.first_ip = existing.first_ip || ipAddress || null;
    existing.last_ip = ipAddress || existing.last_ip || null;
    existing.updated_at = timestamp;
    existing.last_login_at = timestamp;

    return existing;
  });
};

const touchUserLogin = ({ userId, ipAddress }) => {
  return withStore((store) => {
    const user = store.users.find((entry) => entry.id === userId);
    if (!user) {
      return null;
    }

    const timestamp = nowIso();
    user.last_ip = ipAddress || user.last_ip || null;
    user.updated_at = timestamp;
    user.last_login_at = timestamp;
    return user;
  });
};

const setLocalCredentials = ({ userId, username, email = null, passwordHash, displayName, ipAddress }) => {
  return withStore((store) => {
    const user = store.users.find((entry) => entry.id === userId);
    if (!user) {
      return null;
    }

    const normalizedUsername = username ? String(username).trim().toLowerCase() : null;
    const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
    const timestamp = nowIso();

    user.google_sub = normalizedUsername ? `local:${normalizedUsername}` : user.google_sub;
    user.username = normalizedUsername;
    user.email = normalizedEmail;
    user.auth_provider = 'local';
    user.password_hash = passwordHash || user.password_hash || null;
    user.display_name = displayName || user.display_name;
    user.first_ip = user.first_ip || ipAddress || null;
    user.last_ip = ipAddress || user.last_ip || null;
    user.updated_at = timestamp;
    user.last_login_at = user.last_login_at || timestamp;
    return user;
  });
};

const clearLocalCredentials = ({ userId }) => {
  return withStore((store) => {
    const user = store.users.find((entry) => entry.id === userId);
    if (!user || user.auth_provider !== 'local') {
      return user || null;
    }

    user.username = null;
    user.email = null;
    user.password_hash = null;
    user.updated_at = nowIso();
    return user;
  });
};

const deleteUserById = ({ userId }) => {
  withStore((store) => {
    store.users = store.users.filter((entry) => entry.id !== userId);
    return null;
  });
};

const setUserRole = ({ userId, role }) => {
  return withStore((store) => {
    const user = store.users.find((entry) => entry.id === userId);
    if (!user) {
      return null;
    }

    user.role = normalizeRole(role);
    user.updated_at = nowIso();
    return user;
  });
};

const listUsers = () => {
  const store = readStore();
  return [...store.users].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
};

const createThread = ({ title, body, authorUserId }) => {
  return withStore((store) => {
    const timestamp = nowIso();
    store.counters.threads += 1;
    const thread = {
      id: store.counters.threads,
      title,
      body,
      author_user_id: authorUserId,
      locked: 0,
      created_at: timestamp,
      updated_at: timestamp,
    };

    store.forumThreads.push(thread);
    return thread;
  });
};

const listThreads = () => {
  const store = readStore();

  const threads = store.forumThreads.map((thread) => {
    const author = store.users.find((user) => user.id === thread.author_user_id);
    const replyCount = store.forumPosts.filter((post) => post.thread_id === thread.id).length;

    return {
      id: thread.id,
      title: thread.title,
      body: thread.body,
      locked: thread.locked,
      created_at: thread.created_at,
      updated_at: thread.updated_at,
      author_name: author?.display_name || 'Unbekannt',
      author_role: author?.role || 'member',
      reply_count: replyCount,
    };
  });

  return threads.sort((a, b) => {
    const byUpdate = String(b.updated_at).localeCompare(String(a.updated_at));
    if (byUpdate !== 0) {
      return byUpdate;
    }
    return String(b.created_at).localeCompare(String(a.created_at));
  });
};

const getThreadById = (threadId) => {
  const store = readStore();
  const thread = store.forumThreads.find((entry) => entry.id === threadId);
  if (!thread) {
    return null;
  }

  const author = store.users.find((user) => user.id === thread.author_user_id);
  return {
    id: thread.id,
    title: thread.title,
    body: thread.body,
    locked: thread.locked,
    created_at: thread.created_at,
    updated_at: thread.updated_at,
    author_name: author?.display_name || 'Unbekannt',
    author_role: author?.role || 'member',
  };
};

const listPostsForThread = (threadId) => {
  const store = readStore();
  return store.forumPosts
    .filter((post) => post.thread_id === threadId)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map((post) => {
      const author = store.users.find((user) => user.id === post.author_user_id);
      return {
        id: post.id,
        body: post.body,
        created_at: post.created_at,
        author_name: author?.display_name || 'Unbekannt',
        author_role: author?.role || 'member',
        avatar_url: author?.avatar_url || null,
      };
    });
};

const createPost = ({ threadId, authorUserId, body }) => {
  return withStore((store) => {
    const timestamp = nowIso();

    store.counters.posts += 1;
    const post = {
      id: store.counters.posts,
      thread_id: threadId,
      author_user_id: authorUserId,
      body,
      created_at: timestamp,
    };

    store.forumPosts.push(post);

    const thread = store.forumThreads.find((entry) => entry.id === threadId);
    if (thread) {
      thread.updated_at = timestamp;
    }

    return post;
  });
};

const setThreadLocked = ({ threadId, locked }) => {
  return withStore((store) => {
    const thread = store.forumThreads.find((entry) => entry.id === threadId);
    if (!thread) {
      return null;
    }

    thread.locked = locked ? 1 : 0;
    thread.updated_at = nowIso();

    const author = store.users.find((user) => user.id === thread.author_user_id);
    return {
      id: thread.id,
      title: thread.title,
      body: thread.body,
      locked: thread.locked,
      created_at: thread.created_at,
      updated_at: thread.updated_at,
      author_name: author?.display_name || 'Unbekannt',
      author_role: author?.role || 'member',
    };
  });
};

const recordAuditEvent = ({ actorUserId = null, eventType, payload }) => {
  withStore((store) => {
    store.counters.auditEvents += 1;
    store.auditEvents.push({
      id: store.counters.auditEvents,
      actor_user_id: actorUserId,
      event_type: eventType,
      payload: JSON.stringify(payload ?? {}),
      created_at: nowIso(),
    });
    return null;
  });
};

module.exports = {
  initDb,
  getDatabase,
  countUsers,
  createLocalUser,
  setLocalCredentials,
  clearLocalCredentials,
  deleteUserById,
  findUserById,
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
