const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(process.env.PORTAL_DATA_DIR || path.join(__dirname, 'data'));
const storePath = path.join(dataDir, 'portal-data.json');

const nowIso = () => new Date().toISOString();

const UNIT_MEDALS = [
  {
    id: 'storm-honor-star',
    name: 'Storm Honor Star',
    description: 'Auszeichnung fuer besonderes Pflichtbewusstsein im Einsatz.',
    tier: 'gold',
  },
  {
    id: 'vanguard-cross',
    name: 'Vanguard Cross',
    description: 'Verliehen fuer fuehrende Rolle in kritischen Operationen.',
    tier: 'silver',
  },
  {
    id: 'recon-wings',
    name: 'Recon Wings',
    description: 'Anerkennung fuer exzellente Aufklaerung und Lageberichte.',
    tier: 'bronze',
  },
  {
    id: 'shield-of-coruscant',
    name: 'Shield of Coruscant',
    description: 'Verliehen fuer Schutz und Sicherung der Einheit unter Druck.',
    tier: 'gold',
  },
  {
    id: 'discipline-ribbon',
    name: 'Discipline Ribbon',
    description: 'Konstante Disziplin und verlaesslicher Dienst ueber lange Zeit.',
    tier: 'silver',
  },
];

const unitMedalMap = new Map(UNIT_MEDALS.map((entry) => [entry.id, entry]));

const toPublicProfile = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    display_name: user.display_name,
    role: user.role,
    avatar_url: user.avatar_url || null,
    callsign: user.callsign || null,
    bio: user.bio || '',
    created_at: user.created_at,
    last_login_at: user.last_login_at || null,
  };
};

const normalizeRole = (role) => {
  const allowed = new Set(['owner', 'admin', 'moderator', 'member']);
  return allowed.has(role) ? role : 'member';
};

const createDefaultStore = () => ({
  counters: {
    users: 0,
    threads: 0,
    posts: 0,
    follows: 0,
    medalAssignments: 0,
    auditEvents: 0,
  },
  users: [],
  forumThreads: [],
  forumPosts: [],
  follows: [],
  userMedals: [],
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
      counters: {
        ...createDefaultStore().counters,
        ...(parsed.counters || {}),
      },
      users: Array.isArray(parsed.users) ? parsed.users : [],
      forumThreads: Array.isArray(parsed.forumThreads) ? parsed.forumThreads : [],
      forumPosts: Array.isArray(parsed.forumPosts) ? parsed.forumPosts : [],
      follows: Array.isArray(parsed.follows) ? parsed.follows : [],
      userMedals: Array.isArray(parsed.userMedals) ? parsed.userMedals : [],
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
      callsign: null,
      bio: '',
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
        callsign: null,
        bio: '',
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
    existing.callsign = existing.callsign || null;
    existing.bio = existing.bio || '';
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
    user.callsign = user.callsign || null;
    user.bio = user.bio || '';
    user.first_ip = user.first_ip || ipAddress || null;
    user.last_ip = ipAddress || user.last_ip || null;
    user.updated_at = timestamp;
    user.last_login_at = user.last_login_at || timestamp;
    return user;
  });
};

const updateUserProfile = ({ userId, displayName, avatarUrl, callsign, bio }) => {
  return withStore((store) => {
    const user = store.users.find((entry) => entry.id === userId);
    if (!user) {
      return null;
    }

    user.display_name = displayName;
    user.avatar_url = avatarUrl;
    user.callsign = callsign;
    user.bio = bio;
    user.updated_at = nowIso();

    return toPublicProfile(user);
  });
};

const mapUserMedals = ({ store, userId }) => {
  const usersById = new Map(store.users.map((entry) => [entry.id, entry]));

  return (store.userMedals || [])
    .filter((entry) => entry.user_id === userId)
    .map((entry) => {
      const medal = unitMedalMap.get(entry.medal_id);
      if (!medal) {
        return null;
      }

      const grantedBy = usersById.get(entry.granted_by_user_id);
      return {
        medal_id: medal.id,
        name: medal.name,
        description: medal.description,
        tier: medal.tier,
        granted_at: entry.granted_at,
        granted_by_user_id: entry.granted_by_user_id,
        granted_by_display_name: grantedBy?.display_name || 'Unbekannt',
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.granted_at).localeCompare(String(a.granted_at)));
};

const buildProfileStats = ({ store, userId, viewerUserId = null }) => {
  const ownThreads = store.forumThreads.filter((thread) => thread.author_user_id === userId);
  const ownPosts = store.forumPosts.filter((post) => post.author_user_id === userId);
  const follows = Array.isArray(store.follows) ? store.follows : [];

  const followerCount = follows.filter((entry) => entry.target_user_id === userId).length;
  const followingCount = follows.filter((entry) => entry.follower_user_id === userId).length;
  const isFollowing = Boolean(
    viewerUserId
      && follows.some((entry) => entry.follower_user_id === viewerUserId && entry.target_user_id === userId),
  );

  const timestamps = [];
  ownThreads.forEach((thread) => {
    if (thread.updated_at) {
      timestamps.push(thread.updated_at);
    }
    if (thread.created_at) {
      timestamps.push(thread.created_at);
    }
  });
  ownPosts.forEach((post) => {
    if (post.created_at) {
      timestamps.push(post.created_at);
    }
  });

  const validDates = timestamps
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b - a);

  return {
    thread_count: ownThreads.length,
    post_count: ownPosts.length,
    follower_count: followerCount,
    following_count: followingCount,
    is_following: isFollowing,
    last_forum_activity: validDates[0] ? validDates[0].toISOString() : null,
    medals: mapUserMedals({ store, userId }),
  };
};

const getPublicProfileById = (userId, viewerUserId = null) => {
  const store = readStore();
  const user = store.users.find((entry) => entry.id === userId);
  if (!user) {
    return null;
  }

  return {
    ...toPublicProfile(user),
    ...buildProfileStats({ store, userId: user.id, viewerUserId }),
  };
};

const listPublicProfiles = (viewerUserId = null) => {
  const store = readStore();

  return [...store.users]
    .map((user) => ({
      ...toPublicProfile(user),
      ...buildProfileStats({ store, userId: user.id, viewerUserId }),
    }))
    .filter(Boolean)
    .sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || '')));
};

const setFollowState = ({ followerUserId, targetUserId, follow }) => {
  if (!Number.isInteger(followerUserId) || !Number.isInteger(targetUserId)) {
    return null;
  }
  if (followerUserId <= 0 || targetUserId <= 0 || followerUserId === targetUserId) {
    return null;
  }

  return withStore((store) => {
    const followerUser = store.users.find((entry) => entry.id === followerUserId);
    const targetUser = store.users.find((entry) => entry.id === targetUserId);
    if (!followerUser || !targetUser) {
      return null;
    }

    if (!Array.isArray(store.follows)) {
      store.follows = [];
    }

    const existingIndex = store.follows.findIndex((entry) => {
      return entry.follower_user_id === followerUserId && entry.target_user_id === targetUserId;
    });

    if (follow) {
      if (existingIndex < 0) {
        store.counters.follows += 1;
        store.follows.push({
          id: store.counters.follows,
          follower_user_id: followerUserId,
          target_user_id: targetUserId,
          created_at: nowIso(),
        });
      }
    } else if (existingIndex >= 0) {
      store.follows.splice(existingIndex, 1);
    }

    return buildProfileStats({ store, userId: targetUserId, viewerUserId: followerUserId });
  });
};

const listContacts = ({ userId }) => {
  if (!Number.isInteger(userId) || userId <= 0) {
    return [];
  }

  const store = readStore();
  const follows = Array.isArray(store.follows) ? store.follows : [];
  const followedIds = [...new Set(
    follows
      .filter((entry) => entry.follower_user_id === userId)
      .map((entry) => entry.target_user_id),
  )];

  return followedIds
    .map((targetUserId) => {
      const user = store.users.find((entry) => entry.id === targetUserId);
      if (!user) {
        return null;
      }

      return {
        ...toPublicProfile(user),
        ...buildProfileStats({ store, userId: user.id, viewerUserId: userId }),
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || '')));
};

const listUnitMedals = () => UNIT_MEDALS.map((entry) => ({ ...entry }));

const awardUnitMedal = ({ targetUserId, medalId, grantedByUserId }) => {
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return null;
  }
  if (!Number.isInteger(grantedByUserId) || grantedByUserId <= 0) {
    return null;
  }
  if (!unitMedalMap.has(medalId)) {
    return null;
  }

  return withStore((store) => {
    const targetUser = store.users.find((entry) => entry.id === targetUserId);
    const grantedByUser = store.users.find((entry) => entry.id === grantedByUserId);
    if (!targetUser || !grantedByUser) {
      return null;
    }

    if (!Array.isArray(store.userMedals)) {
      store.userMedals = [];
    }

    const alreadyAssigned = store.userMedals.some((entry) => {
      return entry.user_id === targetUserId && entry.medal_id === medalId;
    });

    if (!alreadyAssigned) {
      store.counters.medalAssignments += 1;
      store.userMedals.push({
        id: store.counters.medalAssignments,
        user_id: targetUserId,
        medal_id: medalId,
        granted_by_user_id: grantedByUserId,
        granted_at: nowIso(),
      });
    }

    return mapUserMedals({ store, userId: targetUserId });
  });
};

const revokeUnitMedal = ({ targetUserId, medalId }) => {
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return null;
  }
  if (!unitMedalMap.has(medalId)) {
    return null;
  }

  return withStore((store) => {
    if (!Array.isArray(store.userMedals)) {
      store.userMedals = [];
    }

    const before = store.userMedals.length;
    store.userMedals = store.userMedals.filter((entry) => {
      return !(entry.user_id === targetUserId && entry.medal_id === medalId);
    });

    if (before === store.userMedals.length) {
      return null;
    }

    return mapUserMedals({ store, userId: targetUserId });
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
    store.follows = (store.follows || []).filter((entry) => {
      return entry.follower_user_id !== userId && entry.target_user_id !== userId;
    });
    store.userMedals = (store.userMedals || []).filter((entry) => {
      return entry.user_id !== userId && entry.granted_by_user_id !== userId;
    });
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
      author_user_id: author?.id || null,
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
    author_user_id: author?.id || null,
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
        author_user_id: author?.id || null,
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
      author_user_id: author?.id || null,
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

const listMedalAuditEvents = ({ limit = 100 } = {}) => {
  const store = readStore();
  const usersById = new Map(store.users.map((entry) => [entry.id, entry]));
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  return [...(store.auditEvents || [])]
    .filter((entry) => entry.event_type === 'profile_medal_award' || entry.event_type === 'profile_medal_revoke')
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, safeLimit)
    .map((entry) => {
      let payload = {};
      try {
        payload = JSON.parse(entry.payload || '{}');
      } catch {
        payload = {};
      }

      const actor = usersById.get(entry.actor_user_id);
      const target = usersById.get(payload.targetUserId);

      return {
        id: entry.id,
        event_type: entry.event_type,
        created_at: entry.created_at,
        medal_id: payload.medalId || null,
        actor_user_id: entry.actor_user_id || null,
        actor_display_name: actor?.display_name || 'Unbekannt',
        target_user_id: payload.targetUserId || null,
        target_display_name: target?.display_name || 'Unbekannt',
      };
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
  updateUserProfile,
  getPublicProfileById,
  listPublicProfiles,
  setFollowState,
  listContacts,
  listUnitMedals,
  awardUnitMedal,
  revokeUnitMedal,
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
  listMedalAuditEvents,
};
