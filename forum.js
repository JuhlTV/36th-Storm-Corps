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
const forumRoleAdminPanel = document.getElementById('forum-role-admin-panel');
const forumRoleStatusPanel = document.getElementById('forum-role-status-panel');
const forumUserList = document.getElementById('forum-user-list');
const forumAdminNote = document.getElementById('forum-admin-note');
const forumAdminRefresh = document.getElementById('forum-admin-refresh');
const forumAuditRefresh = document.getElementById('forum-audit-refresh');
const forumAuditList = document.getElementById('forum-audit-list');
const forumMedalAdminPanel = document.getElementById('forum-medal-admin-panel');
const forumMedalUserSelect = document.getElementById('forum-medal-user-select');
const forumMedalSelect = document.getElementById('forum-medal-select');
const forumMedalAwardBtn = document.getElementById('forum-medal-award-btn');
const forumMedalRevokeBtn = document.getElementById('forum-medal-revoke-btn');
const forumMedalNote = document.getElementById('forum-medal-note');
const forumProfileForm = document.getElementById('forum-profile-form');
const forumProfileDisplayName = document.getElementById('forum-profile-display-name');
const forumProfileCallsign = document.getElementById('forum-profile-callsign');
const forumProfileAvatar = document.getElementById('forum-profile-avatar');
const forumProfileAvatarFile = document.getElementById('forum-profile-avatar-file');
const forumProfileAvatarUpload = document.getElementById('forum-profile-avatar-upload');
const forumProfileBio = document.getElementById('forum-profile-bio');
const forumProfileSave = document.getElementById('forum-profile-save');
const forumProfileNote = document.getElementById('forum-profile-note');
const forumProfileSelect = document.getElementById('forum-profile-select');
const forumProfileView = document.getElementById('forum-profile-view');
const forumContactsList = document.getElementById('forum-contacts-list');
const forumContactsRefresh = document.getElementById('forum-contacts-refresh');
const forumRevealSections = document.querySelectorAll('.section-reveal');
const forumThreadSubmitBtn = forumThreadForm?.querySelector('[type="submit"]');
const forumReplySubmitBtn = forumReplyForm?.querySelector('[type="submit"]');

let selectedThreadId = null;
let currentUser = null;
let ownerLockInfo = null;
let currentUsers = [];
let currentThreadCache = [];
let currentProfiles = [];
let currentContacts = [];
let unitMedals = [];
let medalAuditEntries = [];
let selectedProfileId = null;

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

const formatProfileDate = (value) => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const raw = String(reader.result || '');
    const base64 = raw.includes(',') ? raw.split(',')[1] : '';
    if (!base64) {
      reject(new Error('Datei konnte nicht verarbeitet werden.'));
      return;
    }
    resolve(base64);
  };
  reader.onerror = () => reject(new Error('Datei-Lesen fehlgeschlagen.'));
  reader.readAsDataURL(file);
});

const currentForumLocation = () => {
  const pageName = window.location.pathname.split('/').pop() || 'forum.html';
  return `${pageName}${window.location.search}${window.location.hash}`;
};

const canManageMedals = () => Boolean(currentUser && ['owner', 'admin', 'moderator'].includes(currentUser.role));
const canManageUsers = () => Boolean(currentUser && ['owner', 'admin'].includes(currentUser.role));

const renderMedalAdminControls = () => {
  if (!forumMedalAdminPanel || !forumMedalSelect || !forumMedalUserSelect) {
    return;
  }

  if (!canManageMedals()) {
    forumMedalAdminPanel.hidden = true;
    return;
  }

  forumMedalAdminPanel.hidden = false;

  const userOptions = ['<option value="">Nutzer waehlen...</option>'];
  currentProfiles.forEach((profile) => {
    const roleSuffix = profile.role ? ` (${profile.role})` : '';
    userOptions.push(`<option value="${profile.id}">${escapeHtml(profile.display_name)}${escapeHtml(roleSuffix)}</option>`);
  });
  forumMedalUserSelect.innerHTML = userOptions.join('');

  const medalOptions = ['<option value="">Medaillie waehlen...</option>'];
  unitMedals.forEach((medal) => {
    medalOptions.push(`<option value="${escapeHtml(medal.id)}">${escapeHtml(medal.name)}</option>`);
  });
  forumMedalSelect.innerHTML = medalOptions.join('');

  if (forumMedalNote) {
    forumMedalNote.textContent = 'Bereit.';
  }
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

  const canOpenAdminPanel = canManageMedals() || canManageUsers();
  if (forumAdminSection) {
    forumAdminSection.hidden = !canOpenAdminPanel;
  }

  if (forumRoleAdminPanel) {
    forumRoleAdminPanel.hidden = !canManageUsers();
  }
  if (forumRoleStatusPanel) {
    forumRoleStatusPanel.hidden = !canManageUsers();
  }
};

const renderMedalAudit = (entries) => {
  if (!forumAuditList) {
    return;
  }

  if (!Array.isArray(entries) || !entries.length) {
    forumAuditList.innerHTML = '<p class="forum-empty">Noch keine Medaillen-Audit-Eintraege vorhanden.</p>';
    return;
  }

  forumAuditList.innerHTML = entries.map((entry) => {
    const actionLabel = entry.event_type === 'profile_medal_award' ? 'vergeben' : 'entzogen';
    return `
      <article class="forum-audit-card">
        <p class="forum-meta"><strong>${escapeHtml(entry.actor_display_name || 'Unbekannt')}</strong> hat <strong>${escapeHtml(entry.medal_id || 'unbekannt')}</strong> ${actionLabel}.</p>
        <p class="forum-meta">Ziel: ${escapeHtml(entry.target_display_name || 'Unbekannt')} | Zeitpunkt: ${escapeHtml(formatProfileDate(entry.created_at))}</p>
      </article>
    `;
  }).join('');
};

const renderProfileView = (profile) => {
  if (!forumProfileView) {
    return;
  }

  if (!profile) {
    forumProfileView.innerHTML = '<p class="forum-empty">Noch kein Profil ausgewaehlt.</p>';
    return;
  }

  const avatar = profile.avatar_url
    ? `<img src="${escapeHtml(profile.avatar_url)}" alt="Avatar von ${escapeHtml(profile.display_name)}" class="forum-profile-avatar" loading="lazy" />`
    : '<div class="forum-profile-avatar forum-profile-avatar--fallback" aria-hidden="true">36</div>';

  const isOwnProfile = currentUser && profile.id === currentUser.id;
  const followAction = !isOwnProfile
    ? `<button type="button" class="btn btn-ghost" data-follow-toggle="${profile.id}" data-following="${profile.is_following ? '1' : '0'}">${profile.is_following ? 'Entfolgen' : 'Folgen'}</button>`
    : '';

  const profileLink = `<a class="btn btn-ghost" href="profile/${profile.id}" target="_blank" rel="noopener">Profilseite oeffnen</a>`;
  const medalEntries = Array.isArray(profile.medals) ? profile.medals : [];
  const medalListMarkup = medalEntries.length
    ? `<div class="forum-medal-list">${medalEntries.map((medal) => `<span class="forum-medal-chip forum-medal-chip--${escapeHtml(medal.tier || 'bronze')}" title="${escapeHtml(medal.description || '')}">${escapeHtml(medal.name)}</span>`).join('')}</div>`
    : '<p class="forum-empty">Keine Medaillen vergeben.</p>';

  forumProfileView.innerHTML = `
    <article class="forum-thread-view forum-profile-card">
      <header class="forum-thread-view-head forum-profile-head">
        ${avatar}
        <div>
          <h3>${escapeHtml(profile.display_name)}</h3>
          <p class="forum-meta">${escapeHtml(profile.role)}${profile.callsign ? ` | Callsign: ${escapeHtml(profile.callsign)}` : ''}</p>
        </div>
      </header>
      <p class="forum-thread-body">${escapeHtml(profile.bio || 'Noch keine Profilbeschreibung hinterlegt.')}</p>
      <p class="forum-meta">Mitglied seit: ${escapeHtml(formatProfileDate(profile.created_at))}</p>
      <p class="forum-meta">Letzte Aktivitaet: ${escapeHtml(formatProfileDate(profile.last_login_at))}</p>
      <p class="forum-meta">Letzte Forum-Aktivitaet: ${escapeHtml(formatProfileDate(profile.last_forum_activity))}</p>
      <div class="forum-profile-stats">
        <span>Threads: ${Number(profile.thread_count || 0)}</span>
        <span>Posts: ${Number(profile.post_count || 0)}</span>
        <span>Follower: ${Number(profile.follower_count || 0)}</span>
        <span>Folgt: ${Number(profile.following_count || 0)}</span>
      </div>
      <div class="forum-profile-actions">
        ${followAction}
        ${profileLink}
      </div>
      <section class="forum-medal-section">
        <h4>Einheits-Medaillien</h4>
        ${medalListMarkup}
      </section>
    </article>
  `;

  forumProfileView.querySelectorAll('[data-follow-toggle]').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetUserId = Number(button.dataset.followToggle);
      const currentlyFollowing = button.dataset.following === '1';

      try {
        setBusyState(button, true, currentlyFollowing ? 'Entfolge...' : 'Folge...');

        const data = await apiFetch(`/api/profiles/${targetUserId}/follow`, {
          method: 'POST',
          body: JSON.stringify({ follow: !currentlyFollowing }),
        });

        renderProfileView(data.profile);
        await loadProfiles();
        await loadContacts();
      } catch (error) {
        showForumToast(error.message, 'error');
      } finally {
        setBusyState(button, false);
      }
    });
  });

};

const renderContacts = (contacts) => {
  if (!forumContactsList) {
    return;
  }

  if (!Array.isArray(contacts) || !contacts.length) {
    forumContactsList.innerHTML = '<p class="forum-empty">Keine Kontakte vorhanden.</p>';
    return;
  }

  forumContactsList.innerHTML = contacts.map((contact) => `
    <article class="forum-contact-card">
      <div class="forum-contact-top">
        <strong><button type="button" class="forum-link-button" data-profile-open="${contact.id}">${escapeHtml(contact.display_name)}</button></strong>
        <span class="forum-meta">${escapeHtml(contact.role || 'member')}</span>
      </div>
      <p class="forum-meta">Letzte Forum-Aktivitaet: ${escapeHtml(formatProfileDate(contact.last_forum_activity))}</p>
    </article>
  `).join('');

  attachProfileButtons(forumContactsList);
};

const loadContacts = async () => {
  if (!currentUser) {
    return;
  }

  const data = await apiFetch('/api/me/contacts');
  currentContacts = data.contacts || [];
  renderContacts(currentContacts);
};

const loadUnitMedals = async () => {
  if (!currentUser) {
    return;
  }

  const data = await apiFetch('/api/medals');
  unitMedals = Array.isArray(data.medals) ? data.medals : [];
};

const fillProfileForm = (profile) => {
  if (!profile || !forumProfileForm) {
    return;
  }

  forumProfileDisplayName.value = profile.display_name || '';
  forumProfileCallsign.value = profile.callsign || '';
  forumProfileAvatar.value = profile.avatar_url || '';
  if (forumProfileAvatarFile) {
    forumProfileAvatarFile.value = '';
  }
  forumProfileBio.value = profile.bio || '';
  forumProfileNote.textContent = 'Profil geladen. Du kannst jetzt Anpassungen speichern.';
};

const renderProfileOptions = (profiles) => {
  if (!forumProfileSelect) {
    return;
  }

  const options = ['<option value="">Profil waehlen...</option>'];
  profiles.forEach((profile) => {
    const roleSuffix = profile.role ? ` (${profile.role})` : '';
    options.push(`<option value="${profile.id}">${escapeHtml(profile.display_name)}${escapeHtml(roleSuffix)}</option>`);
  });
  forumProfileSelect.innerHTML = options.join('');

  if (selectedProfileId) {
    forumProfileSelect.value = String(selectedProfileId);
  }
};

const openProfile = async (profileId) => {
  const parsedId = Number(profileId);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return;
  }

  selectedProfileId = parsedId;
  if (forumProfileSelect) {
    forumProfileSelect.value = String(parsedId);
  }

  try {
    const data = await apiFetch(`/api/profiles/${parsedId}`);
    renderProfileView(data.profile);
  } catch (error) {
    renderProfileView(null);
    showForumToast(error.message, 'error');
  }
};

const attachProfileButtons = (root) => {
  if (!root) {
    return;
  }

  root.querySelectorAll('[data-profile-open]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const id = Number(button.dataset.profileOpen);
      if (!Number.isInteger(id) || id <= 0) {
        return;
      }

      openProfile(id);
      forumProfileView?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
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
        <strong><button type="button" class="forum-link-button" data-profile-open="${user.id}">${escapeHtml(user.display_name)}</button></strong>
        <span>${escapeHtml(user.role)}</span>
      </div>
      <select data-role-select="${user.id}">
        <option value="member" ${user.role === 'member' ? 'selected' : ''}>member</option>
        <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>moderator</option>
        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin</option>
        <option value="owner" ${user.role === 'owner' ? 'selected' : ''}>owner</option>
      </select>
    </div>
  `).join('');

  attachProfileButtons(forumUserList);

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
        <span>${thread.author_user_id ? `<button type="button" class="forum-link-button" data-profile-open="${thread.author_user_id}">${escapeHtml(thread.author_name)}</button>` : escapeHtml(thread.author_name)}</span>
        <span>${escapeHtml(thread.author_role)}</span>
      </span>
    </button>
  `).join('');

  forumThreadList.querySelectorAll('[data-thread-id]').forEach((button) => {
    button.addEventListener('click', () => loadThread(Number(button.dataset.threadId)));
  });

  attachProfileButtons(forumThreadList);
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
        <p class="forum-meta">${thread.author_user_id ? `<button type="button" class="forum-link-button" data-profile-open="${thread.author_user_id}">${escapeHtml(thread.author_name)}</button>` : escapeHtml(thread.author_name)} | ${escapeHtml(thread.author_role)} | ${escapeHtml(thread.created_at)}</p>
      </header>
      <p class="forum-thread-body">${escapeHtml(thread.body)}</p>
    </article>
    <div class="forum-post-list">
      ${posts.length ? posts.map((post) => `
        <article class="forum-post">
          <header class="forum-post-head">
            <p class="forum-meta">${post.author_user_id ? `<button type="button" class="forum-link-button" data-profile-open="${post.author_user_id}">${escapeHtml(post.author_name)}</button>` : escapeHtml(post.author_name)} | ${escapeHtml(post.author_role)} | ${escapeHtml(post.created_at)}</p>
          </header>
          <p class="forum-post-body">${escapeHtml(post.body)}</p>
        </article>
      `).join('') : '<p class="forum-empty">Noch keine Antworten. Sei die erste Rueckmeldung in diesem Thread.</p>'}
    </div>
  `;

  attachProfileButtons(forumThreadDetail);
};

const loadProfiles = async () => {
  const data = await apiFetch('/api/profiles');
  currentProfiles = data.profiles || [];
  renderProfileOptions(currentProfiles);
  renderMedalAdminControls();

  if (!selectedProfileId && currentUser?.id) {
    selectedProfileId = currentUser.id;
  }

  if (selectedProfileId) {
    await openProfile(selectedProfileId);
  }
};

const loadMyProfile = async () => {
  if (!currentUser) {
    return;
  }

  const data = await apiFetch('/api/me/profile');
  fillProfileForm(data.profile);
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
  if (!canManageUsers()) {
    return;
  }

  const data = await apiFetch('/api/users');
  renderUsers(data.users);
};

const loadMedalAudit = async () => {
  if (!canManageMedals()) {
    medalAuditEntries = [];
    renderMedalAudit([]);
    return;
  }

  const data = await apiFetch('/api/audit/medals?limit=120');
  medalAuditEntries = Array.isArray(data.entries) ? data.entries : [];
  renderMedalAudit(medalAuditEntries);
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

forumAuditRefresh?.addEventListener('click', async () => {
  setBusyState(forumAuditRefresh, true, 'Lade...');
  try {
    await loadMedalAudit();
    showForumToast('Medaillen-Audit aktualisiert', 'success');
  } catch (error) {
    showForumToast(error.message, 'error');
  } finally {
    setBusyState(forumAuditRefresh, false);
  }
});

forumMedalAwardBtn?.addEventListener('click', async () => {
  const targetUserId = Number(forumMedalUserSelect?.value);
  const medalId = String(forumMedalSelect?.value || '').trim();

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    showForumToast('Bitte zuerst einen Nutzer waehlen.', 'error');
    return;
  }
  if (!medalId) {
    showForumToast('Bitte zuerst eine Medaillie waehlen.', 'error');
    return;
  }

  try {
    setBusyState(forumMedalAwardBtn, true, 'Vergabe...');
    const data = await apiFetch(`/api/profiles/${targetUserId}/medals`, {
      method: 'POST',
      body: JSON.stringify({ medalId }),
    });

    if (forumMedalNote) {
      forumMedalNote.textContent = `Medaillie vergeben: ${medalId}`;
    }

    if (selectedProfileId === targetUserId) {
      renderProfileView(data.profile);
    }

    await loadProfiles();
    await loadMedalAudit();
    showForumToast('Medaillie vergeben', 'success');
  } catch (error) {
    if (forumMedalNote) {
      forumMedalNote.textContent = error.message;
    }
    showForumToast(error.message, 'error');
  } finally {
    setBusyState(forumMedalAwardBtn, false);
  }
});

forumMedalRevokeBtn?.addEventListener('click', async () => {
  const targetUserId = Number(forumMedalUserSelect?.value);
  const medalId = String(forumMedalSelect?.value || '').trim();

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    showForumToast('Bitte zuerst einen Nutzer waehlen.', 'error');
    return;
  }
  if (!medalId) {
    showForumToast('Bitte zuerst eine Medaillie waehlen.', 'error');
    return;
  }

  try {
    setBusyState(forumMedalRevokeBtn, true, 'Entzug...');
    const data = await apiFetch(`/api/profiles/${targetUserId}/medals/${encodeURIComponent(medalId)}`, {
      method: 'DELETE',
    });

    if (forumMedalNote) {
      forumMedalNote.textContent = `Medaillie entzogen: ${medalId}`;
    }

    if (selectedProfileId === targetUserId) {
      renderProfileView(data.profile);
    }

    await loadProfiles();
    await loadMedalAudit();
    showForumToast('Medaillie entzogen', 'success');
  } catch (error) {
    if (forumMedalNote) {
      forumMedalNote.textContent = error.message;
    }
    showForumToast(error.message, 'error');
  } finally {
    setBusyState(forumMedalRevokeBtn, false);
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

forumProfileSelect?.addEventListener('change', async () => {
  const profileId = Number(forumProfileSelect.value);
  if (!Number.isInteger(profileId) || profileId <= 0) {
    selectedProfileId = null;
    renderProfileView(null);
    return;
  }

  await openProfile(profileId);
});

forumContactsRefresh?.addEventListener('click', async () => {
  setBusyState(forumContactsRefresh, true, 'Lade...');
  try {
    await loadContacts();
    showForumToast('Kontakte aktualisiert', 'success');
  } catch (error) {
    showForumToast(error.message, 'error');
  } finally {
    setBusyState(forumContactsRefresh, false);
  }
});

forumProfileAvatarUpload?.addEventListener('click', async () => {
  if (!currentUser) {
    showForumToast('Bitte zuerst einloggen.', 'error');
    return;
  }

  const file = forumProfileAvatarFile?.files?.[0];
  if (!file) {
    showForumToast('Bitte zuerst eine Datei auswaehlen.', 'error');
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    showForumToast('Datei ist zu gross (max. 2 MB).', 'error');
    return;
  }

  setBusyState(forumProfileAvatarUpload, true, 'Upload...');

  try {
    const dataBase64 = await fileToBase64(file);
    const data = await apiFetch('/api/me/avatar', {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type,
        dataBase64,
      }),
    });

    forumProfileAvatar.value = data.avatarUrl || data.profile?.avatar_url || '';
    forumProfileNote.textContent = 'Profilbild erfolgreich hochgeladen.';
    showForumToast('Profilbild aktualisiert', 'success');
    await loadProfiles();
    await loadContacts();
  } catch (error) {
    showForumToast(error.message, 'error');
  } finally {
    setBusyState(forumProfileAvatarUpload, false);
  }
});

forumProfileForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser) {
    showForumToast('Bitte zuerst einloggen.', 'error');
    return;
  }

  const payload = {
    displayName: forumProfileDisplayName.value.trim(),
    callsign: forumProfileCallsign.value.trim(),
    avatarUrl: forumProfileAvatar.value.trim(),
    bio: forumProfileBio.value.trim(),
  };

  setBusyState(forumProfileSave, true, 'Speichere...');

  try {
    const data = await apiFetch('/api/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    forumProfileNote.textContent = 'Profil gespeichert.';
    showForumToast('Profil gespeichert', 'success');

    currentUser.display_name = data.profile.display_name;
    forumAuthState.textContent = data.profile.display_name;

    selectedProfileId = data.profile.id;
    await loadProfiles();
    await loadContacts();
    await loadThreads();
  } catch (error) {
    forumProfileNote.textContent = error.message;
    showForumToast(error.message, 'error');
  } finally {
    setBusyState(forumProfileSave, false);
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
    if (canManageUsers()) {
      await loadAdminUsers();
    }
    if (canManageMedals()) {
      await loadMedalAudit();
    }
    await loadUnitMedals();
    await loadMyProfile();
    await loadProfiles();
    await loadContacts();
    await loadThreads();
  } catch (error) {
    forumThreadDetail.innerHTML = `<p class="forum-empty">${escapeHtml(error.message)}</p>`;
    showForumToast(error.message, 'error');
  }
})();