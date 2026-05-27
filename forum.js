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
const forumRevealSections = document.querySelectorAll('.section-reveal');
const forumThreadSubmitBtn = forumThreadForm?.querySelector('[type="submit"]');
const forumReplySubmitBtn = forumReplyForm?.querySelector('[type="submit"]');

let selectedThreadId = null;
let currentUser = null;
let ownerLockInfo = null;
let currentUsers = [];
let currentThreadCache = [];

const forumToastRoot = document.createElement('div');
forumToastRoot.className = 'toast-stack';
forumToastRoot.setAttribute('aria-live', 'polite');
forumToastRoot.setAttribute('aria-atomic', 'true');
document.body.appendChild(forumToastRoot);

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const showForumToast = (message, type = 'info') => {
  if (!message) {
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  forumToastRoot.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));

  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 220);
  }, 2600);
};

const setBusyState = (button, busy, busyLabel) => {
  if (!button) {
    return;
  }

  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent.trim();
  }

  button.disabled = Boolean(busy);
  button.classList.toggle('is-busy', Boolean(busy));
  button.setAttribute('aria-busy', busy ? 'true' : 'false');
  button.textContent = busy ? (busyLabel || button.dataset.defaultLabel) : button.dataset.defaultLabel;
};

const currentForumLocation = () => {
  const pageName = window.location.pathname.split('/').pop() || 'forum.html';
  return `${pageName}${window.location.search}${window.location.hash}`;
};

const redirectToLogin = () => {
  const target = encodeURIComponent(currentForumLocation());
  window.location.replace(`login.html?redirect=${target}`);
};

const revealForumSections = () => {
  forumRevealSections.forEach((section, index) => {
    section.style.transitionDelay = `${Math.min(index * 70, 280)}ms`;
    section.classList.add('visible');
  });
};

const apiFetch = async (url, options = {}) => {
  const apiClient = window.StormCorpsApi?.apiFetchRaw;
  if (typeof apiClient !== 'function') {
    throw new Error('API-Konfiguration fehlt. Seite neu laden und erneut versuchen.');
  }

  const method = String(options.method || 'GET').toUpperCase();
  const shouldSendJsonHeader = method !== 'GET' && method !== 'HEAD' && options.body !== undefined;
  const mergedHeaders = {
    ...(shouldSendJsonHeader ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  try {
    const response = await apiClient(url, {
      ...(Object.keys(mergedHeaders).length ? { headers: mergedHeaders } : {}),
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (String(error?.message || '').startsWith('Request failed:') || error?.message === 'Not authenticated' || error?.message === 'Insufficient permissions') {
      throw error;
    }

    if (error?.name === 'AbortError') {
      throw new Error('API-Anfrage hat zu lange gedauert. Bitte erneut versuchen.');
    }
  }

  throw new Error('Portal API ist nicht erreichbar. Starte den Portal-Server auf Port 3000.');
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
      const userRecord = users.find((user) => user.id === userId);
      const previousRole = userRecord?.role || 'member';
      const userLabel = userRecord?.display_name || `Nutzer ${userId}`;

      try {
        select.disabled = true;

        await apiFetch(`/api/users/${userId}/role`, {
          method: 'PATCH',
          body: JSON.stringify({ role }),
        });

        if (forumAdminNote) {
          forumAdminNote.textContent = `Rolle fuer ${userLabel} wurde von ${previousRole} auf ${role} gesetzt.`;
        }

        showForumToast(`Rolle aktualisiert: ${userLabel} ist jetzt ${role}.`, 'success');

        await loadAdminUsers();
      } catch (error) {
        if (forumAdminNote) {
          forumAdminNote.textContent = `Rollenupdate fuer ${userLabel} fehlgeschlagen: ${error.message}`;
        }
        showForumToast(`Rollenupdate fehlgeschlagen fuer ${userLabel}.`, 'error');
        select.value = previousRole;
      } finally {
        select.disabled = false;
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
      <span class="forum-thread-card-top">
        <strong>${escapeHtml(thread.title)}</strong>
        <span class="forum-thread-replies">${thread.reply_count} Antworten</span>
      </span>
      <span class="forum-thread-card-meta">
        <span>${escapeHtml(thread.author_name)}</span>
        <span>${escapeHtml(thread.author_role)}</span>
      </span>
    </button>
  `).join('');

  forumThreadList.querySelectorAll('[data-thread-id]').forEach((button) => {
    button.addEventListener('click', () => loadThread(Number(button.dataset.threadId)));
  });
};

const renderThreadSkeleton = () => {
  forumThreadList.innerHTML = Array.from({ length: 4 }, () => `
    <div class="forum-thread-card forum-skeleton-card" aria-hidden="true">
      <span class="forum-skeleton forum-skeleton-line"></span>
      <span class="forum-skeleton forum-skeleton-line forum-skeleton-line--short"></span>
    </div>
  `).join('');

  forumThreadDetail.innerHTML = `
    <div class="forum-thread-view forum-skeleton-block" aria-hidden="true">
      <span class="forum-skeleton forum-skeleton-line"></span>
      <span class="forum-skeleton forum-skeleton-line forum-skeleton-line--medium"></span>
      <span class="forum-skeleton forum-skeleton-line forum-skeleton-line--short"></span>
    </div>
  `;
};

const renderThreadDetail = (thread, posts) => {
  forumReplyThread.value = thread ? thread.title : 'Kein Thread gewaehlt';

  if (!thread) {
    forumThreadDetail.innerHTML = '<p class="forum-empty">Waehle einen Thread aus oder erzeuge einen neuen.</p>';
    return;
  }

  forumThreadDetail.innerHTML = `
    <article class="forum-thread-view">
      <header class="forum-thread-view-head">
        <h3>${escapeHtml(thread.title)}</h3>
        <p class="forum-meta">${escapeHtml(thread.author_name)} | ${escapeHtml(thread.author_role)} | ${escapeHtml(thread.created_at)}</p>
      </header>
      <p class="forum-thread-body">${escapeHtml(thread.body)}</p>
    </article>
    <div class="forum-post-list">
      ${posts.length ? posts.map((post) => `
        <article class="forum-post">
          <header class="forum-post-head">
            <p class="forum-meta">${escapeHtml(post.author_name)} | ${escapeHtml(post.author_role)} | ${escapeHtml(post.created_at)}</p>
          </header>
          <p class="forum-post-body">${escapeHtml(post.body)}</p>
        </article>
      `).join('') : '<p class="forum-empty">Noch keine Antworten. Sei die erste Rueckmeldung in diesem Thread.</p>'}
    </div>
  `;
};

const loadThreads = async () => {
  renderThreadSkeleton();
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

const loadAdminUsers = async () => {
  if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) {
    return;
  }

  const data = await apiFetch('/api/users');
  renderUsers(data.users);
};

forumRefreshBtn?.addEventListener('click', async () => {
  setBusyState(forumRefreshBtn, true, 'Aktualisiere...');
  try {
    await loadThreads();
    showForumToast('Threads aktualisiert', 'success');
  } catch (error) {
    showForumToast(error.message, 'error');
  } finally {
    setBusyState(forumRefreshBtn, false);
  }
});

forumAdminRefresh?.addEventListener('click', async () => {
  setBusyState(forumAdminRefresh, true, 'Lade...');
  try {
    await loadAdminUsers();
  } finally {
    setBusyState(forumAdminRefresh, false);
  }
});

forumLogoutBtn?.addEventListener('click', async () => {
  setBusyState(forumLogoutBtn, true, 'Melde ab...');
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
    redirectToLogin();
  } catch (error) {
    forumAuthState.textContent = error.message;
    showForumToast(error.message, 'error');
    setBusyState(forumLogoutBtn, false);
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

  if (!title || !body) {
    forumThreadFormNote.textContent = 'Bitte Titel und Inhalt ausfuellen.';
    showForumToast('Titel und Inhalt sind erforderlich.', 'error');
    return;
  }

  setBusyState(forumThreadSubmitBtn, true, 'Posting...');

  try {
    await apiFetch('/api/forum/threads', {
      method: 'POST',
      body: JSON.stringify({ title, body }),
    });

    forumThreadTitle.value = '';
    forumThreadBody.value = '';
    forumThreadFormNote.textContent = 'Thread erfolgreich gepostet.';
    showForumToast('Thread erfolgreich gepostet', 'success');
    await loadThreads();
  } catch (error) {
    forumThreadFormNote.textContent = error.message;
    showForumToast(error.message, 'error');
  } finally {
    setBusyState(forumThreadSubmitBtn, false);
  }
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

  try {
    const body = forumReplyBody.value.trim();

    if (!body) {
      forumReplyFormNote.textContent = 'Bitte eine Antwort eingeben.';
      showForumToast('Antwort darf nicht leer sein.', 'error');
      return;
    }

    setBusyState(forumReplySubmitBtn, true, 'Sende...');

    await apiFetch(`/api/forum/threads/${selectedThreadId}/posts`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });

    forumReplyBody.value = '';
    forumReplyFormNote.textContent = 'Antwort erfolgreich gepostet.';
    showForumToast('Antwort erfolgreich gepostet', 'success');
    await loadThread(selectedThreadId);
  } catch (error) {
    forumReplyFormNote.textContent = error.message;
    showForumToast(error.message, 'error');
  } finally {
    setBusyState(forumReplySubmitBtn, false);
  }
});

(async () => {
  try {
    revealForumSections();
    await renderAuthState();
    if (!currentUser) {
      redirectToLogin();
      return;
    }
    if (currentUser && ['owner', 'admin'].includes(currentUser.role)) {
      await loadAdminUsers();
    }
    await loadThreads();
  } catch (error) {
    forumThreadDetail.innerHTML = `<p class="forum-empty">${escapeHtml(error.message)}</p>`;
    showForumToast(error.message, 'error');
  }
})();