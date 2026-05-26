const forumAuthState = document.getElementById('forum-auth-state');
const forumRoleState = document.getElementById('forum-role-state');
const forumOwnerState = document.getElementById('forum-owner-state');
const forumThreadCount = document.getElementById('forum-thread-count');
const forumThreadList = document.getElementById('forum-thread-list');
const forumThreadDetail = document.getElementById('forum-thread-detail');
const forumRefreshBtn = document.getElementById('forum-refresh-btn');
const forumLogoutBtn = document.getElementById('forum-logout-btn');
const forumThreadForm = document.getElementById('forum-thread-form');
const forumThreadTitle = document.getElementById('forum-thread-title');
const forumThreadBody = document.getElementById('forum-thread-body');
const forumThreadFormNote = document.getElementById('forum-thread-form-note');
const forumReplyForm = document.getElementById('forum-reply-form');
const forumReplyThread = document.getElementById('forum-reply-thread');
const forumReplyBody = document.getElementById('forum-reply-body');
const forumReplyFormNote = document.getElementById('forum-reply-form-note');
const forumAdminSection = document.getElementById('forum-admin-section');
const forumUserList = document.getElementById('forum-user-list');
const forumAdminNote = document.getElementById('forum-admin-note');
const forumAdminRefresh = document.getElementById('forum-admin-refresh');
const forumLoginForm = document.getElementById('forum-login-form');
const forumLoginIdentity = document.getElementById('forum-login-identity');
const forumLoginPassword = document.getElementById('forum-login-password');
const forumLoginNote = document.getElementById('forum-login-note');
const forumRegisterForm = document.getElementById('forum-register-form');
const forumRegisterUsername = document.getElementById('forum-register-username');
const forumRegisterDisplay = document.getElementById('forum-register-display');
const forumRegisterEmail = document.getElementById('forum-register-email');
const forumRegisterPassword = document.getElementById('forum-register-password');
const forumRegisterNote = document.getElementById('forum-register-note');

let selectedThreadId = null;
let currentUser = null;
let ownerLockInfo = null;
let currentUsers = [];

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  return response.json();
};

const renderAuthState = async () => {
  const bootstrap = await apiFetch('/api/bootstrap');
  ownerLockInfo = bootstrap.owner;

  const me = await apiFetch('/api/me');
  currentUser = me.user;

  if (currentUser) {
    forumAuthState.textContent = currentUser.display_name;
    forumRoleState.textContent = currentUser.role;
  } else {
    forumAuthState.textContent = 'Nicht angemeldet';
    forumRoleState.textContent = 'guest';
  }

  if (ownerLockInfo?.ipLockEnabled) {
    forumOwnerState.textContent = ownerLockInfo.ipAudit ? 'IP-Lock aktiv' : 'IP-Lock aktiv';
  } else if (ownerLockInfo?.username || ownerLockInfo?.email || ownerLockInfo?.googleSub) {
    forumOwnerState.textContent = 'Owner konfiguriert';
  } else {
    forumOwnerState.textContent = 'Noch nicht gesetzt';
  }

  forumThreadFormNote.textContent = currentUser ? 'Thread kann jetzt gepostet werden.' : 'Zum Posten musst du eingeloggt sein.';
  forumReplyFormNote.textContent = currentUser ? 'Antworten sind jetzt aktiv.' : 'Antworten sind nur fuer eingeloggte Nutzer aktiv.';

  const canManageUsers = currentUser && ['owner', 'admin'].includes(currentUser.role);
  if (forumAdminSection) {
    forumAdminSection.hidden = !canManageUsers;
  }
};

const renderUsers = (users) => {
  currentUsers = users;

  if (!forumUserList) {
    return;
  }

  if (!users.length) {
    forumUserList.innerHTML = '<p class="forum-empty">Keine Nutzer geladen.</p>';
    return;
  }

  forumUserList.innerHTML = users.map((user) => `
    <div class="forum-user-card" data-user-id="${user.id}">
      <div>
        <strong>${escapeHtml(user.display_name)}</strong>
        <span>${escapeHtml(user.email || 'keine E-Mail')} | ${escapeHtml(user.role)}</span>
      </div>
      <select data-role-select="${user.id}">
        <option value="member" ${user.role === 'member' ? 'selected' : ''}>member</option>
        <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>moderator</option>
        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin</option>
        <option value="owner" ${user.role === 'owner' ? 'selected' : ''}>owner</option>
      </select>
    </div>
  `).join('');

  forumUserList.querySelectorAll('[data-role-select]').forEach((select) => {
    select.addEventListener('change', async () => {
      const userId = Number(select.dataset.roleSelect);
      const role = select.value;

      try {
        await apiFetch(`/api/users/${userId}/role`, {
          method: 'PATCH',
          body: JSON.stringify({ role }),
        });

        if (forumAdminNote) {
          forumAdminNote.textContent = `Rolle fuer Nutzer ${userId} wurde auf ${role} gesetzt.`;
        }

        await loadAdminUsers();
      } catch (error) {
        if (forumAdminNote) {
          forumAdminNote.textContent = error.message;
        }
        select.value = users.find((user) => user.id === userId)?.role || 'member';
      }
    });
  });
};

const renderThreads = (threads) => {
  forumThreadCount.textContent = String(threads.length);

  if (!threads.length) {
    forumThreadList.innerHTML = '<p class="forum-empty">Noch keine Threads vorhanden.</p>';
    return;
  }

  forumThreadList.innerHTML = threads.map((thread) => `
    <button type="button" class="forum-thread-card ${thread.id === selectedThreadId ? 'is-active' : ''}" data-thread-id="${thread.id}">
      <strong>${escapeHtml(thread.title)}</strong>
      <span>${escapeHtml(thread.author_name)} | ${escapeHtml(thread.author_role)} | ${thread.reply_count} Antworten</span>
    </button>
  `).join('');

  forumThreadList.querySelectorAll('[data-thread-id]').forEach((button) => {
    button.addEventListener('click', () => loadThread(Number(button.dataset.threadId)));
  });
};

const renderThreadDetail = (thread, posts) => {
  forumReplyThread.value = thread ? thread.title : 'Kein Thread gewaehlt';

  if (!thread) {
    forumThreadDetail.innerHTML = '<p class="forum-empty">Waehle einen Thread aus oder erzeuge einen neuen.</p>';
    return;
  }

  forumThreadDetail.innerHTML = `
    <article class="forum-thread-view">
      <h3>${escapeHtml(thread.title)}</h3>
      <p class="forum-meta">${escapeHtml(thread.author_name)} | ${escapeHtml(thread.author_role)} | ${escapeHtml(thread.created_at)}</p>
      <p>${escapeHtml(thread.body)}</p>
    </article>
    <div class="forum-post-list">
      ${posts.map((post) => `
        <article class="forum-post">
          <p class="forum-meta">${escapeHtml(post.author_name)} | ${escapeHtml(post.author_role)} | ${escapeHtml(post.created_at)}</p>
          <p>${escapeHtml(post.body)}</p>
        </article>
      `).join('')}
    </div>
  `;
};

const loadThreads = async () => {
  const data = await apiFetch('/api/forum/threads');
  currentThreadCache = data.threads;
  renderThreads(data.threads);

  if (selectedThreadId) {
    const active = data.threads.find((thread) => thread.id === selectedThreadId);
    if (active) {
      await loadThread(selectedThreadId);
      return;
    }
  }

  if (data.threads[0]) {
    await loadThread(data.threads[0].id);
    return;
  }

  renderThreadDetail(null, []);
};

const loadThread = async (threadId) => {
  selectedThreadId = threadId;
  const data = await apiFetch(`/api/forum/threads/${threadId}`);
  renderThreads(currentThreadCache);
  renderThreadDetail(data.thread, data.posts);
};

let currentThreadCache = [];

const loadAdminUsers = async () => {
  if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) {
    return;
  }

  const data = await apiFetch('/api/users');
  renderUsers(data.users);
};

forumRefreshBtn?.addEventListener('click', async () => {
  await loadThreads();
});

forumAdminRefresh?.addEventListener('click', async () => {
  await loadAdminUsers();
});

forumLogoutBtn?.addEventListener('click', async () => {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
    window.location.reload();
  } catch (error) {
    forumAuthState.textContent = error.message;
  }
});

forumThreadForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!currentUser) {
    forumThreadFormNote.textContent = 'Bitte zuerst einloggen.';
    return;
  }

  const title = forumThreadTitle.value.trim();
  const body = forumThreadBody.value.trim();

  await apiFetch('/api/forum/threads', {
    method: 'POST',
    body: JSON.stringify({ title, body }),
  });

  forumThreadTitle.value = '';
  forumThreadBody.value = '';
  await loadThreads();
});

forumReplyForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!currentUser) {
    forumReplyFormNote.textContent = 'Bitte zuerst einloggen.';
    return;
  }

  if (!selectedThreadId) {
    forumReplyFormNote.textContent = 'Waehle zuerst einen Thread aus.';
    return;
  }

  const body = forumReplyBody.value.trim();
  await apiFetch(`/api/forum/threads/${selectedThreadId}/posts`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });

  forumReplyBody.value = '';
  await loadThread(selectedThreadId);
});

forumLoginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const login = forumLoginIdentity.value.trim();
    const password = forumLoginPassword.value;

    await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });

    forumLoginPassword.value = '';
    forumLoginNote.textContent = 'Login erfolgreich.';
    await renderAuthState();
    if (currentUser && ['owner', 'admin'].includes(currentUser.role)) {
      await loadAdminUsers();
    }
    await loadThreads();
  } catch (error) {
    forumLoginNote.textContent = error.message;
  }
});

forumRegisterForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const username = forumRegisterUsername.value.trim();
    const displayName = forumRegisterDisplay.value.trim();
    const email = forumRegisterEmail.value.trim();
    const password = forumRegisterPassword.value;

    await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, displayName, email, password }),
    });

    forumRegisterPassword.value = '';
    forumRegisterNote.textContent = 'Registrierung erfolgreich. Du bist jetzt eingeloggt.';
    await renderAuthState();
    if (currentUser && ['owner', 'admin'].includes(currentUser.role)) {
      await loadAdminUsers();
    }
    await loadThreads();
  } catch (error) {
    forumRegisterNote.textContent = error.message;
  }
});

(async () => {
  try {
    await renderAuthState();
    if (currentUser && ['owner', 'admin'].includes(currentUser.role)) {
      await loadAdminUsers();
    }
    await loadThreads();
  } catch (error) {
    forumThreadDetail.innerHTML = `<p class="forum-empty">${escapeHtml(error.message)}</p>`;
  }
})();