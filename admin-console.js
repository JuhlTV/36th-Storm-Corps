const portalRoleAdminCard = document.getElementById('portal-role-admin-card');
const portalRoleStatusCard = document.getElementById('portal-role-status-card');
const portalUserList = document.getElementById('portal-user-list');
const portalRoleNote = document.getElementById('portal-role-note');
const portalUsersRefresh = document.getElementById('portal-users-refresh');
const portalMedalCard = document.getElementById('portal-medal-card');
const portalMedalUserSelect = document.getElementById('portal-medal-user-select');
const portalMedalSelect = document.getElementById('portal-medal-select');
const portalMedalAwardBtn = document.getElementById('portal-medal-award-btn');
const portalMedalRevokeBtn = document.getElementById('portal-medal-revoke-btn');
const portalMedalNote = document.getElementById('portal-medal-note');
const portalAuditCard = document.getElementById('portal-audit-card');
const portalAuditRefresh = document.getElementById('portal-audit-refresh');
const portalAuditList = document.getElementById('portal-audit-list');

let currentUser = null;
let currentUsers = [];
let unitMedals = [];
let medalAuditEntries = [];

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

const canManageUsers = () => Boolean(currentUser && ['owner', 'admin'].includes(currentUser.role));
const canManageMedals = () => Boolean(currentUser && ['owner', 'admin', 'moderator'].includes(currentUser.role));

const setBusyState = (button, busy, busyLabel) => {
  if (!button) {
    return;
  }

  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent.trim();
  }

  button.disabled = Boolean(busy);
  button.textContent = busy ? (busyLabel || button.dataset.defaultLabel) : button.dataset.defaultLabel;
};

const renderUsers = (users) => {
  currentUsers = Array.isArray(users) ? users : [];

  if (portalUserList) {
    if (!currentUsers.length) {
      portalUserList.innerHTML = '<p class="forum-empty">Keine Nutzer geladen.</p>';
    } else {
      portalUserList.innerHTML = currentUsers.map((user) => `
        <div class="forum-user-card" data-user-id="${user.id}">
          <div>
            <strong>${escapeHtml(user.display_name)}</strong>
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

      portalUserList.querySelectorAll('[data-role-select]').forEach((select) => {
        select.addEventListener('change', async () => {
          const userId = Number(select.dataset.roleSelect);
          const role = select.value;
          const userRecord = currentUsers.find((user) => user.id === userId);
          const previousRole = userRecord?.role || 'member';

          try {
            select.disabled = true;
            await apiFetch(`/api/users/${userId}/role`, {
              method: 'PATCH',
              body: JSON.stringify({ role }),
            });
            if (portalRoleNote) {
              portalRoleNote.textContent = `Rolle fuer ${userRecord?.display_name || userId} wurde auf ${role} gesetzt.`;
            }
            await loadUsers();
          } catch (error) {
            if (portalRoleNote) {
              portalRoleNote.textContent = error.message;
            }
            select.value = previousRole;
          } finally {
            select.disabled = false;
          }
        });
      });
    }
  }

  if (portalMedalUserSelect) {
    const currentValue = portalMedalUserSelect.value;
    const options = ['<option value="">Nutzer waehlen...</option>'];
    currentUsers.forEach((user) => {
      options.push(`<option value="${user.id}">${escapeHtml(user.display_name)} (${escapeHtml(user.role)})</option>`);
    });
    portalMedalUserSelect.innerHTML = options.join('');
    portalMedalUserSelect.value = currentValue;
  }
};

const renderMedals = () => {
  if (!portalMedalSelect) {
    return;
  }

  const currentValue = portalMedalSelect.value;
  const options = ['<option value="">Medaillie waehlen...</option>'];
  unitMedals.forEach((medal) => {
    options.push(`<option value="${escapeHtml(medal.id)}">${escapeHtml(medal.name)}</option>`);
  });
  portalMedalSelect.innerHTML = options.join('');
  portalMedalSelect.value = currentValue;
};

const renderAudit = (entries) => {
  medalAuditEntries = Array.isArray(entries) ? entries : [];

  if (!portalAuditList) {
    return;
  }

  if (!medalAuditEntries.length) {
    portalAuditList.innerHTML = '<p class="forum-empty">Noch keine Audit-Eintraege geladen.</p>';
    return;
  }

  portalAuditList.innerHTML = medalAuditEntries.map((entry) => {
    const actionLabel = entry.event_type === 'profile_medal_award' ? 'vergeben' : 'entzogen';
    return `
      <article class="forum-audit-card">
        <p class="forum-meta"><strong>${escapeHtml(entry.actor_display_name || 'Unbekannt')}</strong> hat <strong>${escapeHtml(entry.medal_id || 'unbekannt')}</strong> ${actionLabel}.</p>
        <p class="forum-meta">Ziel: ${escapeHtml(entry.target_display_name || 'Unbekannt')} | Zeitpunkt: ${escapeHtml(formatProfileDate(entry.created_at))}</p>
      </article>
    `;
  }).join('');
};

const loadCurrentUser = async () => {
  const me = await apiFetch('/api/me');
  currentUser = me.user;

  if (portalRoleNote) {
    portalRoleNote.textContent = currentUser
      ? `Angemeldet als ${currentUser.display_name} (${currentUser.role}).`
      : 'Nicht angemeldet.';
  }

  if (portalRoleAdminCard) {
    portalRoleAdminCard.hidden = !canManageUsers();
  }
  if (portalRoleStatusCard) {
    portalRoleStatusCard.hidden = !canManageUsers();
  }
  if (portalMedalCard) {
    portalMedalCard.hidden = !canManageMedals();
  }
  if (portalAuditCard) {
    portalAuditCard.hidden = !canManageMedals();
  }
};

const loadUsers = async () => {
  if (!canManageUsers()) {
    renderUsers([]);
    return;
  }

  const data = await apiFetch('/api/users');
  renderUsers(data.users || []);
};

const loadUnitMedals = async () => {
  if (!canManageMedals()) {
    unitMedals = [];
    renderMedals();
    return;
  }

  const data = await apiFetch('/api/medals');
  unitMedals = Array.isArray(data.medals) ? data.medals : [];
  renderMedals();
};

const loadAudit = async () => {
  if (!canManageMedals()) {
    renderAudit([]);
    return;
  }

  const data = await apiFetch('/api/audit/medals?limit=120');
  renderAudit(data.entries || []);
};

portalUsersRefresh?.addEventListener('click', async () => {
  setBusyState(portalUsersRefresh, true, 'Lade...');
  try {
    await loadUsers();
  } finally {
    setBusyState(portalUsersRefresh, false);
  }
});

portalAuditRefresh?.addEventListener('click', async () => {
  setBusyState(portalAuditRefresh, true, 'Lade...');
  try {
    await loadAudit();
  } finally {
    setBusyState(portalAuditRefresh, false);
  }
});

portalMedalAwardBtn?.addEventListener('click', async () => {
  const targetUserId = Number(portalMedalUserSelect?.value);
  const medalId = String(portalMedalSelect?.value || '').trim();

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    if (portalMedalNote) portalMedalNote.textContent = 'Bitte zuerst einen Nutzer waehlen.';
    return;
  }
  if (!medalId) {
    if (portalMedalNote) portalMedalNote.textContent = 'Bitte zuerst eine Medaillie waehlen.';
    return;
  }

  try {
    setBusyState(portalMedalAwardBtn, true, 'Vergabe...');
    const data = await apiFetch(`/api/profiles/${targetUserId}/medals`, {
      method: 'POST',
      body: JSON.stringify({ medalId }),
    });
    if (portalMedalNote) portalMedalNote.textContent = `Medaillie vergeben: ${medalId}`;
    await loadUsers();
    await loadAudit();
    return data;
  } catch (error) {
    if (portalMedalNote) portalMedalNote.textContent = error.message;
  } finally {
    setBusyState(portalMedalAwardBtn, false);
  }
});

portalMedalRevokeBtn?.addEventListener('click', async () => {
  const targetUserId = Number(portalMedalUserSelect?.value);
  const medalId = String(portalMedalSelect?.value || '').trim();

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    if (portalMedalNote) portalMedalNote.textContent = 'Bitte zuerst einen Nutzer waehlen.';
    return;
  }
  if (!medalId) {
    if (portalMedalNote) portalMedalNote.textContent = 'Bitte zuerst eine Medaillie waehlen.';
    return;
  }

  try {
    setBusyState(portalMedalRevokeBtn, true, 'Entzug...');
    await apiFetch(`/api/profiles/${targetUserId}/medals/${encodeURIComponent(medalId)}`, {
      method: 'DELETE',
    });
    if (portalMedalNote) portalMedalNote.textContent = `Medaillie entzogen: ${medalId}`;
    await loadUsers();
    await loadAudit();
  } catch (error) {
    if (portalMedalNote) portalMedalNote.textContent = error.message;
  } finally {
    setBusyState(portalMedalRevokeBtn, false);
  }
});

(async () => {
  try {
    await loadCurrentUser();
    await loadUsers();
    await loadUnitMedals();
    await loadAudit();
  } catch (error) {
    if (portalRoleNote) {
      portalRoleNote.textContent = error.message;
    }
  }
})();
