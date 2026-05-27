const profileTitle = document.getElementById('profile-title');
const profileSubtitle = document.getElementById('profile-subtitle');
const profileCard = document.getElementById('profile-card');
const profileStats = document.getElementById('profile-stats');
const profileFollowBtn = document.getElementById('profile-follow-btn');
const profileEditPanel = document.getElementById('profile-edit-panel');
const profileEditForm = document.getElementById('profile-edit-form');
const profileEditDisplayName = document.getElementById('profile-edit-display-name');
const profileEditCallsign = document.getElementById('profile-edit-callsign');
const profileEditAvatar = document.getElementById('profile-edit-avatar');
const profileEditAvatarFile = document.getElementById('profile-edit-avatar-file');
const profileEditAvatarUpload = document.getElementById('profile-edit-avatar-upload');
const profileEditBio = document.getElementById('profile-edit-bio');
const profileEditSave = document.getElementById('profile-edit-save');
const profileEditNote = document.getElementById('profile-edit-note');
const profileContactsPanel = document.getElementById('profile-contacts-panel');
const profileContactsList = document.getElementById('profile-contacts-list');
const profileContactsRefresh = document.getElementById('profile-contacts-refresh');

let currentUser = null;
let viewedProfile = null;
let currentContacts = [];

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

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

  const response = await apiClient(url, {
    ...(Object.keys(mergedHeaders).length ? { headers: mergedHeaders } : {}),
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  return response.json();
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

const getProfileIdFromPath = () => {
  const segments = window.location.pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] || '';
  const profileId = Number(lastSegment);
  return Number.isInteger(profileId) && profileId > 0 ? profileId : null;
};

const renderContacts = (contacts) => {
  if (!profileContactsList) {
    return;
  }

  if (!Array.isArray(contacts) || !contacts.length) {
    profileContactsList.innerHTML = '<p class="forum-empty">Keine Kontakte vorhanden.</p>';
    return;
  }

  profileContactsList.innerHTML = contacts.map((contact) => `
    <article class="forum-contact-card">
      <div class="forum-contact-top">
        <strong>${escapeHtml(contact.display_name)}</strong>
        <span class="forum-meta">${escapeHtml(contact.role || 'member')}</span>
      </div>
      <p class="forum-meta">Letzte Forum-Aktivitaet: ${escapeHtml(formatProfileDate(contact.last_forum_activity))}</p>
    </article>
  `).join('');
};

const loadContacts = async () => {
  if (!currentUser || !viewedProfile || currentUser.id !== viewedProfile.id) {
    currentContacts = [];
    renderContacts([]);
    return;
  }

  const data = await apiFetch('/api/me/contacts');
  currentContacts = data.contacts || [];
  renderContacts(currentContacts);
};

const loadMyProfile = async () => {
  if (!currentUser || !viewedProfile || currentUser.id !== viewedProfile.id) {
    if (profileEditPanel) {
      profileEditPanel.hidden = true;
    }
    if (profileContactsPanel) {
      profileContactsPanel.hidden = true;
    }
    return;
  }

  const data = await apiFetch('/api/me/profile');
  const profile = data.profile;

  if (profileEditPanel) {
    profileEditPanel.hidden = false;
  }
  if (profileContactsPanel) {
    profileContactsPanel.hidden = false;
  }

  if (profileEditDisplayName) profileEditDisplayName.value = profile.display_name || '';
  if (profileEditCallsign) profileEditCallsign.value = profile.callsign || '';
  if (profileEditAvatar) profileEditAvatar.value = profile.avatar_url || '';
  if (profileEditAvatarFile) profileEditAvatarFile.value = '';
  if (profileEditBio) profileEditBio.value = profile.bio || '';
  if (profileEditNote) profileEditNote.textContent = 'Profil geladen. Du kannst jetzt Anpassungen speichern.';

  await loadContacts();
};

const renderProfile = (profile) => {
  const avatar = profile.avatar_url
    ? `<img src="${escapeHtml(profile.avatar_url)}" alt="Avatar von ${escapeHtml(profile.display_name)}" class="forum-profile-avatar" loading="lazy" />`
    : '<div class="forum-profile-avatar forum-profile-avatar--fallback" aria-hidden="true">36</div>';

  profileCard.innerHTML = `
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
    </article>
  `;

  profileStats.innerHTML = `
    <article class="forum-thread-view">
      <p class="forum-meta">Threads erstellt: ${Number(profile.thread_count || 0)}</p>
      <p class="forum-meta">Posts erstellt: ${Number(profile.post_count || 0)}</p>
      <p class="forum-meta">Follower: ${Number(profile.follower_count || 0)}</p>
      <p class="forum-meta">Folgt: ${Number(profile.following_count || 0)}</p>
      <section class="forum-medal-section">
        <h4>Einheits-Medaillien</h4>
        ${(Array.isArray(profile.medals) && profile.medals.length)
    ? `<div class="forum-medal-list">${profile.medals.map((medal) => `<span class="forum-medal-chip forum-medal-chip--${escapeHtml(medal.tier || 'bronze')}" title="${escapeHtml(medal.description || '')}">${escapeHtml(medal.name)}</span>`).join('')}</div>`
    : '<p class="forum-empty">Keine Medaillen vergeben.</p>'}
      </section>
    </article>
  `;
};

const renderFollowButton = () => {
  if (!currentUser || !viewedProfile || currentUser.id === viewedProfile.id) {
    profileFollowBtn.hidden = true;
    return;
  }

  profileFollowBtn.hidden = false;
  profileFollowBtn.textContent = viewedProfile.is_following ? 'Entfolgen' : 'Folgen';
};

profileContactsRefresh?.addEventListener('click', async () => {
  try {
    await loadContacts();
  } catch (error) {
    if (profileEditNote) {
      profileEditNote.textContent = error.message;
    }
  }
});

profileEditAvatarUpload?.addEventListener('click', async () => {
  if (!currentUser || !viewedProfile || currentUser.id !== viewedProfile.id) {
    return;
  }

  const file = profileEditAvatarFile?.files?.[0];
  if (!file) {
    if (profileEditNote) profileEditNote.textContent = 'Bitte zuerst eine Datei auswaehlen.';
    return;
  }

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

    viewedProfile = data.profile;
    if (profileEditAvatar) profileEditAvatar.value = data.avatarUrl || data.profile?.avatar_url || '';
    profileTitle.textContent = viewedProfile.display_name;
    renderProfile(viewedProfile);
    renderFollowButton();
    await loadMyProfile();
    if (profileEditNote) profileEditNote.textContent = 'Profilbild erfolgreich hochgeladen.';
  } catch (error) {
    if (profileEditNote) profileEditNote.textContent = error.message;
  }
});

profileEditForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!currentUser || !viewedProfile || currentUser.id !== viewedProfile.id) {
    return;
  }

  try {
    const payload = {
      displayName: profileEditDisplayName.value.trim(),
      callsign: profileEditCallsign.value.trim(),
      avatarUrl: profileEditAvatar.value.trim(),
      bio: profileEditBio.value.trim(),
    };

    const data = await apiFetch('/api/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    viewedProfile = data.profile;
    currentUser.display_name = data.profile.display_name;
    profileTitle.textContent = viewedProfile.display_name;
    profileSubtitle.textContent = `Profil-ID ${viewedProfile.id}`;
    renderProfile(viewedProfile);
    renderFollowButton();
    await loadMyProfile();
    if (profileEditNote) profileEditNote.textContent = 'Profil gespeichert.';
  } catch (error) {
    if (profileEditNote) profileEditNote.textContent = error.message;
  }
});

profileFollowBtn?.addEventListener('click', async () => {
  if (!viewedProfile) {
    return;
  }

  profileFollowBtn.disabled = true;
  const follow = !viewedProfile.is_following;

  try {
    const data = await apiFetch(`/api/profiles/${viewedProfile.id}/follow`, {
      method: 'POST',
      body: JSON.stringify({ follow }),
    });

    viewedProfile = data.profile;
    renderProfile(viewedProfile);
    renderFollowButton();
  } catch (error) {
    profileSubtitle.textContent = error.message;
  } finally {
    profileFollowBtn.disabled = false;
  }
});

(async () => {
  try {
    const profileId = getProfileIdFromPath();
    if (!profileId) {
      throw new Error('Ungueltige Profil-ID in der URL.');
    }

    const me = await apiFetch('/api/me');
    currentUser = me.user;
    if (!currentUser) {
      const target = encodeURIComponent(`profile/${profileId}`);
      window.location.replace(`login.html?redirect=${target}`);
      return;
    }

    const data = await apiFetch(`/api/profiles/${profileId}`);
    viewedProfile = data.profile;
    profileTitle.textContent = viewedProfile.display_name;
    profileSubtitle.textContent = `Profil-ID ${viewedProfile.id}`;
    renderProfile(viewedProfile);
    renderFollowButton();
    await loadMyProfile();
  } catch (error) {
    profileSubtitle.textContent = error.message;
    profileCard.innerHTML = `<p class="forum-empty">${escapeHtml(error.message)}</p>`;
    profileStats.innerHTML = '<p class="forum-empty">Keine Daten verfuegbar.</p>';
  }
})();
