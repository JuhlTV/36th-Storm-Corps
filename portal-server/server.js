require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const {
  createAccount,
  findAccountByLogin,
  touchAccountLogin,
} = require('./encrypted-auth-store');
const {
  initDb,
  getDatabase,
  clearLocalCredentials,
  countUsers,
  createLocalUser,
  deleteUserById,
  findUserById,
  findUserByLogin,
  upsertUserFromGoogle,
  listUsers,
  setUserRole,
  touchUserLogin,
  createThread,
  listThreads,
  getThreadById,
  listPostsForThread,
  createPost,
  setThreadLocked,
  recordAuditEvent,
} = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const STATIC_ROOT = path.resolve(__dirname, '..');
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';
const OWNER_USERNAME = process.env.OWNER_USERNAME?.trim().toLowerCase() || '';
const OWNER_EMAIL = process.env.OWNER_EMAIL?.trim().toLowerCase() || '';
const OWNER_GOOGLE_SUB = process.env.OWNER_GOOGLE_SUB?.trim() || '';
const OWNER_IP = process.env.OWNER_IP?.trim() || '';
const OWNER_IP_LOCK = String(process.env.OWNER_IP_LOCK || 'false').toLowerCase() === 'true';
const allowedRoles = new Set(['owner', 'admin', 'moderator', 'member']);
const dataDir = path.join(__dirname, 'data');
const errorLogPath = path.join(dataDir, 'error.log');
initDb();

const sanitizeUser = (user) => {
  if (!user) {
    return null;
  }

  const {
    password_hash,
    ...safeUser
  } = user;

  return safeUser;
};

const sanitizeUsers = (users) => {
  if (!Array.isArray(users)) {
    return [];
  }

  return users.map((user) => sanitizeUser(user));
};

const appendErrorLog = ({ type, message, stack, request }) => {
  try {
    fs.mkdirSync(dataDir, { recursive: true });

    const entry = {
      timestamp: new Date().toISOString(),
      type,
      message,
      stack: stack || null,
      request: request || null,
    };

    fs.appendFileSync(errorLogPath, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (logError) {
    console.error('Failed to write error log:', logError);
  }
};

const syncLocalAccountBestEffort = ({ userId, username, email, passwordHash, req }) => {
  try {
    return createAccount({ userId, username, email, passwordHash });
  } catch (error) {
    appendErrorLog({
      type: 'auth_store_sync_failed',
      message: String(error?.message || error),
      stack: error?.stack || null,
      request: req ? {
        method: req.method,
        path: req.originalUrl,
        ip: getClientIp(req),
        userId: userId || null,
      } : null,
    });

    return null;
  }
};

const touchAccountLoginBestEffort = ({ accountId, req, userId }) => {
  if (!accountId) {
    return;
  }

  try {
    touchAccountLogin({ accountId });
  } catch (error) {
    appendErrorLog({
      type: 'auth_store_touch_failed',
      message: String(error?.message || error),
      stack: error?.stack || null,
      request: req ? {
        method: req.method,
        path: req.originalUrl,
        ip: getClientIp(req),
        userId: userId || null,
      } : null,
    });
  }
};

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.socket.remoteAddress || req.ip || '';
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeUsername = (value) => String(value || '').trim().toLowerCase();

const resolveInitialRole = ({ profile, ipAddress }) => {
  const email = normalizeEmail(profile.emails?.[0]?.value);
  const googleSub = String(profile.id || '');
  const ownerMatched = Boolean(
    (OWNER_EMAIL && email && email === OWNER_EMAIL) ||
    (OWNER_GOOGLE_SUB && googleSub && googleSub === OWNER_GOOGLE_SUB)
  );

  if (ownerMatched) {
    return 'owner';
  }

  if (OWNER_IP_LOCK && OWNER_IP && ipAddress && ipAddress === OWNER_IP) {
    return 'owner';
  }

  return 'member';
};

const resolveInitialLocalRole = ({ username, email, ipAddress, isFirstUser }) => {
  const ownerMatched = Boolean(
    (OWNER_USERNAME && username && username === OWNER_USERNAME) ||
    (OWNER_EMAIL && email && email === OWNER_EMAIL)
  );

  if (ownerMatched) {
    return 'owner';
  }

  if (OWNER_IP_LOCK && OWNER_IP && ipAddress && ipAddress === OWNER_IP) {
    return 'owner';
  }

  if (isFirstUser && !OWNER_USERNAME && !OWNER_EMAIL && !OWNER_GOOGLE_SUB) {
    return 'owner';
  }

  return 'member';
};

const ensureAuth = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  return next();
};

const ensureRole = (roles) => (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const allowed = Array.isArray(roles) ? roles : [roles];
  const userRole = req.user?.role || 'member';

  if (!allowed.includes(userRole)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  return next();
};

const ensureOwner = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = req.user;
  const ipAddress = getClientIp(req);
  const ipAllowed = !OWNER_IP_LOCK || !OWNER_IP || ipAddress === OWNER_IP;

  if (user?.role !== 'owner' || !ipAllowed) {
    return res.status(403).json({ error: 'Owner access required' });
  }

  return next();
};

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((userId, done) => {
  try {
    const currentUser = listUsers().find((entry) => entry.id === userId) || null;
    done(null, currentUser);
  } catch (error) {
    done(error);
  }
});

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL || `http://localhost:${PORT}/auth/google/callback`;

if (googleClientId && googleClientSecret) {
  passport.use(new GoogleStrategy(
    {
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: googleCallbackUrl,
      passReqToCallback: true,
    },
    (req, accessToken, refreshToken, profile, done) => {
      try {
        const ipAddress = getClientIp(req);
        const initialRole = resolveInitialRole({ profile, ipAddress });
        const user = upsertUserFromGoogle({ profile, ipAddress, defaultRole: initialRole });
        done(null, user);
      } catch (error) {
        done(error);
      }
    }
  ));
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  next();
});

app.use(express.static(STATIC_ROOT, {
  extensions: ['html'],
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
}));

app.get('/health', (req, res) => {
  let storageOk = true;
  let storage = 'unknown';

  try {
    const dbInfo = getDatabase();
    storage = dbInfo?.mode || 'unknown';
    countUsers();
  } catch (error) {
    storageOk = false;
    appendErrorLog({
      type: 'health_check_failed',
      message: String(error?.message || error),
      stack: error?.stack || null,
      request: {
        method: req.method,
        path: req.originalUrl,
        ip: getClientIp(req),
      },
    });
  }

  res.status(storageOk ? 200 : 503).json({
    ok: storageOk,
    service: '36th-storm-corps-portal',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    storage,
  });
});

app.get('/auth/google', (req, res, next) => {
  if (!googleClientId || !googleClientSecret) {
    return res.status(501).json({
      error: 'Google OAuth is not configured',
      hint: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env',
    });
  }

  return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.post('/auth/register', async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const displayName = String(req.body?.displayName || '').trim();
    const email = normalizeEmail(req.body?.email || '');
    const password = String(req.body?.password || '');
    const ipAddress = getClientIp(req);

    if (!username || !/^[a-z0-9._-]{3,32}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-32 chars (a-z, 0-9, ., _, -)' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    if (findAccountByLogin(username) || findUserByLogin(username)) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    if (email && (findAccountByLogin(email) || findUserByLogin(email))) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const role = resolveInitialLocalRole({
      username,
      email,
      ipAddress,
      isFirstUser: countUsers() === 0,
    });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = createLocalUser({
      username,
      email: email || null,
      passwordHash: passwordHash,
      displayName: displayName || username,
      ipAddress,
      defaultRole: role,
    });

    syncLocalAccountBestEffort({
      userId: user.id,
      username,
      email: email || null,
      passwordHash,
      req,
    });

    req.logIn(user, (loginError) => {
      if (loginError) {
        return next(loginError);
      }

      recordAuditEvent({
        actorUserId: user.id,
        eventType: 'register',
        payload: { provider: 'local', ipAddress },
      });

      return res.status(201).json({ user: sanitizeUser(user) });
    });

    return undefined;
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    return next(error);
  }
});

app.post('/auth/login', async (req, res, next) => {
  try {
    const login = String(req.body?.login || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const ipAddress = getClientIp(req);

    if (!login || !password) {
      return res.status(400).json({ error: 'Login and password are required' });
    }

    let authAccount = findAccountByLogin(login);
    let dbUser = null;

    if (authAccount && authAccount.passwordHash) {
      const passwordValid = await bcrypt.compare(password, authAccount.passwordHash);
      if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      dbUser = findUserById(authAccount.userId);
      if (!dbUser) {
        return res.status(401).json({ error: 'Account not found' });
      }

      touchAccountLoginBestEffort({ accountId: authAccount.id, req, userId: dbUser.id });
    } else {
      const legacyUser = findUserByLogin(login);
      if (!legacyUser || !legacyUser.password_hash || legacyUser.auth_provider !== 'local') {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const legacyPasswordValid = await bcrypt.compare(password, legacyUser.password_hash);
      if (!legacyPasswordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      authAccount = syncLocalAccountBestEffort({
        userId: legacyUser.id,
        username: legacyUser.username,
        email: legacyUser.email,
        passwordHash: legacyUser.password_hash,
        req,
      });

      touchAccountLoginBestEffort({ accountId: authAccount?.id, req, userId: legacyUser.id });
      dbUser = legacyUser;
    }

    const updatedUser = touchUserLogin({ userId: dbUser.id, ipAddress });
    req.logIn(updatedUser, (loginError) => {
      if (loginError) {
        return next(loginError);
      }

      recordAuditEvent({
        actorUserId: updatedUser.id,
        eventType: 'login',
        payload: { provider: 'local', ipAddress },
      });

      return res.json({ user: sanitizeUser(updatedUser) });
    });

    return undefined;
  } catch (error) {
    return next(error);
  }
});

app.get('/auth/google/callback', (req, res, next) => {
  if (!googleClientId || !googleClientSecret) {
    return res.status(501).json({ error: 'Google OAuth is not configured' });
  }

  return passport.authenticate('google', { failureRedirect: '/admin-console.html' }, (error, user) => {
    if (error) {
      return next(error);
    }

    if (!user) {
      return res.redirect('/admin-console.html?login=failed');
    }

    req.logIn(user, (loginError) => {
      if (loginError) {
        return next(loginError);
      }

      recordAuditEvent({
        actorUserId: user.id,
        eventType: 'login',
        payload: { provider: 'google', ipAddress: getClientIp(req) },
      });

      return res.redirect('/admin-console.html?login=success');
    });

    return undefined;
  })(req, res, next);
});

app.post('/auth/logout', ensureAuth, (req, res, next) => {
  const actorUserId = req.user?.id || null;
  req.logout((error) => {
    if (error) {
      return next(error);
    }

    if (actorUserId) {
      recordAuditEvent({ actorUserId, eventType: 'logout', payload: {} });
    }

    return res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.json({ user: null });
  }

  return res.json({ user: sanitizeUser(req.user) });
});

app.get('/api/users', ensureRole(['owner', 'admin']), (req, res) => {
  res.json({ users: sanitizeUsers(listUsers()) });
});

app.patch('/api/users/:id/role', ensureRole(['owner', 'admin']), (req, res) => {
  const userId = Number(req.params.id);
  const requestedRole = String(req.body?.role || '').trim().toLowerCase();

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  if (!allowedRoles.has(requestedRole)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const updatedUser = setUserRole({ userId, role: requestedRole });

  recordAuditEvent({
    actorUserId: req.user?.id || null,
    eventType: 'role_update',
    payload: { userId, role: requestedRole },
  });

  return res.json({ user: sanitizeUser(updatedUser) });
});

app.get('/api/forum/threads', (req, res) => {
  const threads = listThreads();
  return res.json({ threads });
});

app.post('/api/forum/threads', ensureAuth, (req, res) => {
  const title = String(req.body?.title || '').trim();
  const body = String(req.body?.body || '').trim();

  if (title.length < 3 || body.length < 10) {
    return res.status(400).json({ error: 'Title or body too short' });
  }

  const thread = createThread({ title, body, authorUserId: req.user.id });
  recordAuditEvent({
    actorUserId: req.user.id,
    eventType: 'forum_thread_create',
    payload: { threadId: thread.id, title },
  });

  return res.status(201).json({ thread });
});

app.get('/api/forum/threads/:id', (req, res) => {
  const threadId = Number(req.params.id);
  if (!Number.isInteger(threadId) || threadId <= 0) {
    return res.status(400).json({ error: 'Invalid thread id' });
  }

  const thread = getThreadById(threadId);
  if (!thread) {
    return res.status(404).json({ error: 'Thread not found' });
  }

  return res.json({ thread, posts: listPostsForThread(threadId) });
});

app.post('/api/forum/threads/:id/posts', ensureAuth, (req, res) => {
  const threadId = Number(req.params.id);
  const body = String(req.body?.body || '').trim();
  const thread = getThreadById(threadId);

  if (!thread) {
    return res.status(404).json({ error: 'Thread not found' });
  }

  if (thread.locked) {
    return res.status(423).json({ error: 'Thread is locked' });
  }

  if (body.length < 2) {
    return res.status(400).json({ error: 'Reply is too short' });
  }

  const post = createPost({ threadId, authorUserId: req.user.id, body });
  recordAuditEvent({
    actorUserId: req.user.id,
    eventType: 'forum_post_create',
    payload: { threadId, postId: post.id },
  });

  return res.status(201).json({ post });
});

app.patch('/api/forum/threads/:id/lock', ensureRole(['owner', 'admin', 'moderator']), (req, res) => {
  const threadId = Number(req.params.id);
  const thread = getThreadById(threadId);

  if (!thread) {
    return res.status(404).json({ error: 'Thread not found' });
  }

  const locked = Boolean(req.body?.locked);
  const updatedThread = setThreadLocked({ threadId, locked });

  recordAuditEvent({
    actorUserId: req.user?.id || null,
    eventType: 'forum_thread_lock',
    payload: { threadId, locked },
  });

  return res.json({ thread: updatedThread });
});

app.get('/api/bootstrap', (req, res) => {
  res.json({
    currentUser: sanitizeUser(req.user) || null,
    loginEnabled: true,
    loginMethods: {
      local: true,
      google: Boolean(googleClientId && googleClientSecret),
    },
    owner: {
      username: OWNER_USERNAME || null,
      email: OWNER_EMAIL || null,
      googleSub: OWNER_GOOGLE_SUB || null,
      ipLockEnabled: OWNER_IP_LOCK,
      ipAudit: OWNER_IP || null,
    },
  });
});

app.use((error, req, res, next) => {
  appendErrorLog({
    type: 'request_error',
    message: String(error?.message || error),
    stack: error?.stack || null,
    request: {
      method: req.method,
      path: req.originalUrl,
      ip: getClientIp(req),
      userId: req.user?.id || null,
    },
  });
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  appendErrorLog({
    type: 'unhandled_rejection',
    message: String(reason?.message || reason),
    stack: reason?.stack || null,
  });
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  appendErrorLog({
    type: 'uncaught_exception',
    message: String(error?.message || error),
    stack: error?.stack || null,
  });
  console.error('Uncaught Exception:', error);
});

app.listen(PORT, () => {
  console.log(`36th Storm Corps portal server running on http://localhost:${PORT}`);
});
