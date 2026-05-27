const profileTitle = document.getElementById('profile-title');
const profileSubtitle = document.getElementById('profile-subtitle');
const profileCard = document.getElementById('profile-card');
const profileStats = document.getElementById('profile-stats');
const profileFollowBtn = document.getElementById('profile-follow-btn');

let currentUser = null;
let viewedProfile = null;

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

const getProfileIdFromPath = () => {
  const segments = window.location.pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] || '';
  const profileId = Number(lastSegment);
  return Number.isInteger(profileId) && profileId > 0 ? profileId : null;
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
  } catch (error) {
    profileSubtitle.textContent = error.message;
    profileCard.innerHTML = `<p class="forum-empty">${escapeHtml(error.message)}</p>`;
    profileStats.innerHTML = '<p class="forum-empty">Keine Daten verfuegbar.</p>';
  }
})();
