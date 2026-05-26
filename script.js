const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
const revealSections = document.querySelectorAll('.section-reveal');
const yearNode = document.getElementById('year');
const briefingScreen = document.getElementById('briefing-screen');
const briefingEnter = document.getElementById('briefing-enter');
const briefingCrawlCopy = document.getElementById('briefing-crawl-copy');
const briefingSoundToggle = document.getElementById('briefing-sound-toggle');
const briefingAudioHint = document.getElementById('briefing-audio-hint');
const briefingMusic = document.getElementById('briefing-music');
const navDropdown = document.querySelector('.nav-dropdown');
const dropdownToggle = document.getElementById('unit-menu-toggle');
const navWrap = document.querySelector('.nav-wrap');

const memberSearch = document.getElementById('member-search');
const memberRank = document.getElementById('member-rank');
const memberSpec = document.getElementById('member-spec');
const memberSquad = document.getElementById('member-squad');
const memberStatus = document.getElementById('member-status');
const memberGrid = document.getElementById('member-grid');
const memberEmpty = document.getElementById('member-empty');

const calendarList = document.getElementById('calendar-list');
const medalGrid = document.getElementById('medal-grid');

const sbActiveMembers = document.getElementById('sb-active-members');
const sbTodayOps = document.getElementById('sb-today-ops');
const sbReadiness = document.getElementById('sb-readiness');
const sbChannel = document.getElementById('sb-channel');

const trailerYoutube = document.getElementById('trailer-youtube');
const trailerVideo = document.getElementById('trailer-video');
const trailerMp4Source = document.getElementById('trailer-mp4-source');
const trailerPoster = document.getElementById('trailer-poster-fallback');
const trailerCrawlViewport = document.getElementById('trailer-crawl-viewport');
const trailerCrawlCopy = document.getElementById('trailer-crawl-copy');
const trailerTitle = document.getElementById('trailer-title');
const trailerSub = document.getElementById('trailer-sub');
const adminSchema = document.getElementById('admin-schema');
const adminValidationSummary = document.getElementById('admin-validation-summary');
const adminValidationList = document.getElementById('admin-validation-list');
const adminJsonEditor = document.getElementById('admin-json-editor');
const adminValidateBtn = document.getElementById('admin-validate-btn');
const adminApplyBtn = document.getElementById('admin-apply-btn');
const adminDownloadBtn = document.getElementById('admin-download-btn');
const trailerModeButtons = document.querySelectorAll('.trailer-mode-btn');
const adminModeActive = document.getElementById('admin-mode-active');

let memberCards = Array.from(document.querySelectorAll('.member-card'));
let currentAdminData = null;
let scrollSpySection = null;
let scrollSpyRaf = null;
const THEME_STORAGE_KEY = 'stormcorps36_theme';
const FILTER_STORAGE_KEY = 'stormcorps36_filters';
let filterDebounceTimer = null;
let lastFilterState = {};
let currentSortBy = 'name'; // 'name', 'rank', 'squad', 'status'

const ICON_PATHS = {
  lore: 'M4 4.5A2.5 2.5 0 016.5 2H19v16H6.5A2.5 2.5 0 004 20.5V4.5zm2 .5v12.8c.16-.05.33-.08.5-.08H17V4H6.5A1 1 0 006 5zM8 7h7v1.5H8V7zm0 3h7v1.5H8V10z',
  admin: 'M11 2h2l.6 2.04c.49.13.95.32 1.38.56l1.92-.92 1.42 1.42-.92 1.92c.24.43.43.89.56 1.38L20 11v2l-2.04.6a6.1 6.1 0 01-.56 1.38l.92 1.92-1.42 1.42-1.92-.92a6.1 6.1 0 01-1.38.56L13 22h-2l-.6-2.04a6.1 6.1 0 01-1.38-.56l-1.92.92-1.42-1.42.92-1.92A6.1 6.1 0 016.04 13L4 12v-2l2.04-.6c.13-.49.32-.95.56-1.38l-.92-1.92 1.42-1.42 1.92.92c.43-.24.89-.43 1.38-.56L11 2zm1 6a4 4 0 100 8 4 4 0 000-8z',
  operations: 'M3 4h18v4H3V4zm2 6h14v10H5V10zm3 2v6h2v-6H8zm4 2v4h2v-4h-2z',
};

const ADMIN_SCHEMA_EXAMPLE = {
  ui: {
    defaultTheme: 'tactical',
    commandAlerts: [
      {
        level: 'info',
        icon: 'operations',
        message: 'Server Mirror aktiv: Neutraler Clone-Wars-Start ab Geonosis.',
        linkLabel: 'Operations-Hub',
        linkUrl: 'operations-hub.html',
      },
      {
        level: 'warn',
        icon: 'admin',
        message: 'Admin-Hinweis: Neue Einsatztermine bitte mit ISO-Datum pflegen.',
        linkLabel: 'Admin-Konsole',
        linkUrl: 'admin-console.html',
      },
    ],
  },
  trailer: {
    mode: 'youtube-first',
    title: 'TRAILER FEED: STORMCORPS_36TH',
    subtitle: 'Republic combat preview. Falls YouTube nicht gesetzt ist, wird MP4 verwendet; falls MP4 fehlt, erscheint das Poster.',
    youtubeUrl: 'https://www.youtube.com/watch?v=VIDEO_ID',
    mp4Url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1518331647614-3004c5fbecc3?auto=format&fit=crop&w=1400&q=80',
  },
  statusboard: {
    readiness: 'Aurek-1',
    channel: 'COM-NET 36.7',
  },
  members: [
    {
      id: 'CC-2425',
      callsign: 'Texer',
      rank: 'Senior Commander',
      specialization: 'Command',
      squad: 'High Command',
      status: 'Active',
      description: 'Fuehrt die Corps-Doktrin, Freigaben und operative Endentscheidung im Feldraum.',
    },
    {
      id: 'CT-2426',
      callsign: 'Master',
      rank: 'First Lieutenant',
      specialization: 'Command',
      squad: 'High Command',
      status: 'Active',
      description: 'Leitet Einsatzrotationen, Ressourcensteuerung und sektorweite Befehlsweitergabe.',
    },
    {
      id: 'CT-9999',
      callsign: 'Pray',
      rank: 'Sergeant Major',
      specialization: 'Operations',
      squad: 'Command Staff',
      status: 'Active',
      description: 'Uebersetzt Corps-Ziele in taktische Einsatzpakete fuer Aufklaerung und Zugriff.',
    },
    {
      id: 'CT-3644',
      callsign: 'Slate',
      rank: 'Captain',
      specialization: 'Recon Command',
      squad: 'Command Staff',
      status: 'Deployed',
      description: 'Fuehrt vordere Teamachsen, Zielbildpflege und stille Einsatzkoordination.',
    },
    {
      id: 'CT-4401',
      callsign: 'Rift',
      rank: 'Sergeant Major',
      specialization: 'Techniker',
      squad: 'Besh',
      status: 'Active',
      description: 'Signalzugriff und ECM-Koordination.',
    },
    {
      id: 'CT-4178',
      callsign: 'Pulse',
      rank: 'Master Sergeant',
      specialization: 'Medic',
      squad: 'Cresh',
      status: 'Deployed',
      description: 'Trauma-Fuehrung und Exfil-Medical Stack.',
    },
  ],
  operations: [
    {
      title: 'Operation Geonosis',
      description: 'Erster Einsatzrahmen der Einheit im Clone-Wars-Feld.',
      datetime: '2026-05-24T20:00:00',
      capacity: 10,
      participants: 7,
    },
    {
      title: 'Operation Frontline Drill',
      description: 'Praezisionsuebung fuer Aufklaerung und Teambewegung.',
      datetime: '2026-05-27T19:30:00',
      capacity: 8,
      participants: 8,
    },
    {
      title: 'Operation Republic Relay',
      description: 'Funkdisziplin und Reaktionswege unter simuliertem Druck.',
      datetime: '2026-05-30T21:00:00',
      capacity: 5,
      participants: 5,
    },
    {
      title: 'Operation Logistics Chain',
      description: 'Versorgung, Koordination und Einsatzplanung im Hintergrund.',
      datetime: '2026-06-02T20:15:00',
      capacity: 12,
      participants: 4,
    },
  ],
  medals: [
    {
      title: 'Recon Star',
      tier: 'elite',
      icon: 'R',
      earned: true,
      progress: 100,
      goal: 100,
      unlockedAt: '2026-05-16',
      description: 'Fuer aussergewoehnliche Aufklaerungsleistung unter Feinddruck.',
    },
    {
      title: 'Medic Crest',
      tier: 'elite',
      icon: 'M',
      earned: false,
      progress: 68,
      goal: 100,
      unlockedAt: 'pending',
      description: 'Fuer Lebensrettung und Teamstabilisierung unter Feuer.',
    },
    {
      title: 'Tech Sigil',
      tier: 'standard',
      icon: 'T',
      earned: false,
      progress: 42,
      goal: 100,
      unlockedAt: 'pending',
      description: 'Fuer erfolgreiche Systemstoerung oder kritische Feldreparatur.',
    },
    {
      title: 'Command Laurel',
      tier: 'legendary',
      icon: 'C',
      earned: true,
      progress: 100,
      goal: 100,
      unlockedAt: '2026-04-28',
      description: 'Fuer Fuehrung mit null Ausfallquote in mehrstufigen Einsaetzen.',
    },
    {
      title: 'Long Service Mark',
      tier: 'standard',
      icon: 'L',
      earned: false,
      progress: 79,
      goal: 100,
      unlockedAt: 'pending',
      description: 'Fuer Langzeitdienst und bewaehrte Einsatzkontinuitaet.',
    },
  ],
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const debounce = (fn, delay = 200) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

const normalizeValue = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replaceAll(/\s+/g, ' ');

const toFilterKey = (value) => normalizeValue(value)
  .replaceAll(/[^a-z0-9]+/g, '-')
  .replaceAll(/(^-|-$)/g, '');

const isSameLocalDay = (a, b) => (
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()
);

const formatOperationDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'Unbekannt';
  }

  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const resolveOperationState = (date, participants, capacity, now) => {
  if (date instanceof Date && !Number.isNaN(date.getTime()) && date < now) {
    return 'closed';
  }

  if (capacity > 0 && participants >= capacity) {
    return 'full';
  }

  return 'open';
};

const operationStateClass = (state) => {
  if (state === 'closed') {
    return 'state-closed';
  }

  if (state === 'full') {
    return 'state-full';
  }

  return 'state-open';
};

const operationStateLabel = (state) => {
  if (state === 'closed') {
    return 'Closed';
  }

  if (state === 'full') {
    return 'Full';
  }

  return 'Open';
};

const statusClass = (status) => {
  if (status === 'deployed') {
    return 'state-deployed';
  }

  if (status === 'reserve') {
    return 'state-reserve';
  }

  return 'state-active';
};

const toYouTubeEmbedUrl = (rawUrl) => {
  if (!rawUrl) {
    return '';
  }

  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    let videoId = '';

    if (host.includes('youtu.be')) {
      videoId = url.pathname.slice(1).split('/')[0] ?? '';
    } else if (host.includes('youtube.com')) {
      if (url.pathname.startsWith('/watch')) {
        videoId = url.searchParams.get('v') ?? '';
      } else if (url.pathname.startsWith('/shorts/')) {
        videoId = url.pathname.split('/')[2] ?? '';
      } else if (url.pathname.startsWith('/embed/')) {
        videoId = url.pathname.split('/')[2] ?? '';
      }
    }

    if (!videoId) {
      return '';
    }

    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
  } catch {
    return '';
  }
};

const sanitizeTier = (tier) => {
  const key = toFilterKey(tier);
  if (key === 'legendary' || key === 'elite' || key === 'standard') {
    return key;
  }

  return 'standard';
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeTheme = (theme) => {
  const key = toFilterKey(theme);
  return key === 'cinematic' ? 'cinematic' : 'tactical';
};

const iconSvg = (icon, label) => {
  const key = Object.hasOwn(ICON_PATHS, icon) ? icon : 'operations';
  const safeLabel = escapeHtml(label || key);
  return `
    <svg class="ui-icon ui-icon-${key}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" role="img">
      <title>${safeLabel}</title>
      <path d="${ICON_PATHS[key]}"></path>
    </svg>
  `;
};

const ensureThemeSwitcher = () => {
  if (!navWrap || navWrap.querySelector('.theme-switcher')) {
    return;
  }

  const switcher = document.createElement('div');
  switcher.className = 'theme-switcher';
  switcher.setAttribute('role', 'group');
  switcher.setAttribute('aria-label', 'Theme Auswahl');
  switcher.innerHTML = `
    <button type="button" class="theme-btn" data-theme="tactical">Tactical</button>
    <button type="button" class="theme-btn" data-theme="cinematic">Cinematic</button>
  `;

  navWrap.append(switcher);

  switcher.querySelectorAll('.theme-btn').forEach((button) => {
    button.addEventListener('click', () => {
      applyTheme(button.dataset.theme, true);
    });
  });
};

const syncThemeButtons = (theme) => {
  document.querySelectorAll('.theme-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.theme === theme);
  });
};

function applyTheme(theme, persist) {
  const normalized = normalizeTheme(theme);
  document.documentElement.setAttribute('data-theme', normalized);
  syncThemeButtons(normalized);

  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage restrictions.
    }
  }
}

const getStoredTheme = () => {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return normalizeTheme(raw);
  } catch {
    return null;
  }
};

const saveFilterState = (state) => {
  try {
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
    lastFilterState = state;
  } catch {
    // Ignore storage restrictions
  }
};

const getStoredFilterState = () => {
  try {
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const restoreFilterState = () => {
  const state = getStoredFilterState();
  if (memberSearch && state.search) {
    memberSearch.value = state.search;
  }
  if (memberRank && state.rank) {
    memberRank.value = state.rank;
  }
  if (memberSpec && state.spec) {
    memberSpec.value = state.spec;
  }
  if (memberSquad && state.squad) {
    memberSquad.value = state.squad;
  }
  if (memberStatus && state.status) {
    memberStatus.value = state.status;
  }
};

const applyUiConfig = (uiConfig) => {
  const storedTheme = getStoredTheme();
  if (storedTheme) {
    applyTheme(storedTheme, false);
  } else {
    applyTheme(uiConfig?.defaultTheme || 'tactical', false);
  }
};

const applySectionIcons = () => {
  const targets = [
    { section: '.operations, .calendar, .statusboard, .records', icon: 'operations' },
    { section: '.lore, .codex, .doctrine', icon: 'lore' },
    { section: '.admin-tools', icon: 'admin' },
  ];

  targets.forEach((target) => {
    document.querySelectorAll(target.section).forEach((section) => {
      const heading = section.querySelector('h1, h2');
      if (!heading || heading.querySelector('.section-icon')) {
        return;
      }

      const iconNode = document.createElement('span');
      iconNode.className = 'section-icon';
      iconNode.innerHTML = iconSvg(target.icon, `${target.icon} section`);
      heading.prepend(iconNode);
    });
  });
};

const ensurePageTransitionOverlay = () => {
  if (document.querySelector('.page-transition-overlay')) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'page-transition-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.append(overlay);
};

const initPageTransitions = () => {
  ensurePageTransitionOverlay();

  window.addEventListener('pageshow', () => {
    document.body.classList.remove('is-transitioning');
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) {
      return;
    }

    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || link.target === '_blank' || link.hasAttribute('download')) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch {
      return;
    }

    if (url.origin !== window.location.origin) {
      return;
    }

    if (!url.pathname.endsWith('.html')) {
      return;
    }

    const currentPath = window.location.pathname;
    if (url.pathname === currentPath) {
      return;
    }

    event.preventDefault();
    document.body.classList.add('is-transitioning');
    window.setTimeout(() => {
      window.location.href = url.href;
    }, 220);
  });
};

const setModeButtonState = (mode) => {
  trailerModeButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });

  if (adminModeActive) {
    adminModeActive.textContent = `Aktiver Vorschau-Modus: ${mode}`;
  }
};

const validateAdminData = (data) => {
  const items = [];

  if (!data || typeof data !== 'object') {
    items.push({ level: 'error', message: 'Root muss ein JSON-Objekt sein.' });
    return items;
  }

  if (!data.ui || typeof data.ui !== 'object') {
    items.push({ level: 'warn', message: 'ui Objekt fehlt. Theme/Alerts laufen mit Defaults.' });
  } else {
    const themeRaw = toFilterKey(data.ui.defaultTheme || 'tactical');
    if (!['tactical', 'cinematic'].includes(themeRaw)) {
      items.push({ level: 'warn', message: 'ui.defaultTheme ist ungueltig. Erlaubt: tactical, cinematic.' });
    }

    if (data.ui.commandAlerts !== undefined && !Array.isArray(data.ui.commandAlerts)) {
      items.push({ level: 'error', message: 'ui.commandAlerts muss ein Array sein.' });
    }

    if (Array.isArray(data.ui.commandAlerts)) {
      data.ui.commandAlerts.forEach((alert, index) => {
        const path = `ui.commandAlerts[${index}]`;
        if (!String(alert?.message ?? '').trim()) {
          items.push({ level: 'error', message: `${path}.message fehlt.` });
        }

        const level = toFilterKey(alert?.level || 'info');
        if (!['info', 'warn', 'critical'].includes(level)) {
          items.push({ level: 'warn', message: `${path}.level sollte info, warn oder critical sein.` });
        }
      });
    }
  }

  const requiredArrays = ['members', 'operations', 'medals'];
  requiredArrays.forEach((key) => {
    if (!Array.isArray(data[key])) {
      items.push({ level: 'error', message: `${key} muss ein Array sein.` });
    }
  });

  if (!data.trailer || typeof data.trailer !== 'object') {
    items.push({ level: 'error', message: 'trailer Objekt fehlt.' });
  } else {
    const mode = toFilterKey(data.trailer.mode || 'youtube-first');
    const allowedModes = ['youtube-first', 'mp4-first', 'poster-only'];

    if (!allowedModes.includes(mode)) {
      items.push({ level: 'error', message: 'trailer.mode muss youtube-first, mp4-first oder poster-only sein.' });
    }

    if (!data.trailer.youtubeUrl && !data.trailer.mp4Url && !data.trailer.posterUrl) {
      items.push({ level: 'warn', message: 'trailer hat keine Quelle. Setze youtubeUrl, mp4Url oder posterUrl.' });
    }
  }

  if (!data.statusboard || typeof data.statusboard !== 'object') {
    items.push({ level: 'warn', message: 'statusboard Objekt fehlt. Es werden Default-Werte verwendet.' });
  }

  if (Array.isArray(data.members)) {
    data.members.forEach((member, index) => {
      const path = `members[${index}]`;
      ['id', 'callsign', 'rank', 'specialization', 'squad', 'status'].forEach((key) => {
        if (!member || !String(member[key] ?? '').trim()) {
          items.push({ level: 'error', message: `${path}.${key} fehlt.` });
        }
      });
    });
  }

  if (Array.isArray(data.operations)) {
    data.operations.forEach((op, index) => {
      const path = `operations[${index}]`;
      if (!String(op?.title ?? '').trim()) {
        items.push({ level: 'error', message: `${path}.title fehlt.` });
      }

      const date = new Date(op?.datetime);
      if (Number.isNaN(date.getTime())) {
        items.push({ level: 'error', message: `${path}.datetime ist kein valides ISO-Datum.` });
      }

      const participants = Number(op?.participants ?? 0);
      const capacity = Number(op?.capacity ?? 0);
      if (participants < 0 || capacity < 0) {
        items.push({ level: 'error', message: `${path} participants/capacity duerfen nicht negativ sein.` });
      }
      if (capacity > 0 && participants > capacity) {
        items.push({ level: 'warn', message: `${path} hat participants > capacity.` });
      }
    });
  }

  if (Array.isArray(data.medals)) {
    data.medals.forEach((medal, index) => {
      const path = `medals[${index}]`;
      if (!String(medal?.title ?? '').trim()) {
        items.push({ level: 'error', message: `${path}.title fehlt.` });
      }
      const tierRaw = toFilterKey(medal?.tier ?? 'standard');
      if (!['legendary', 'elite', 'standard'].includes(tierRaw)) {
        items.push({ level: 'warn', message: `${path}.tier ist ungueltig, fallback auf standard.` });
      }

      const progress = Number(medal?.progress ?? 0);
      const goal = Number(medal?.goal ?? 100);
      if (goal <= 0) {
        items.push({ level: 'warn', message: `${path}.goal sollte > 0 sein.` });
      }
      if (progress < 0) {
        items.push({ level: 'warn', message: `${path}.progress sollte >= 0 sein.` });
      }
    });
  }

  if (items.length === 0) {
    items.push({ level: 'ok', message: 'Validierung erfolgreich. Keine Fehler gefunden.' });
  }

  return items;
};

const renderValidationOutput = (items) => {
  if (!adminValidationList || !adminValidationSummary) {
    return;
  }

  const errorCount = items.filter((item) => item.level === 'error').length;
  const warnCount = items.filter((item) => item.level === 'warn').length;

  if (errorCount > 0) {
    adminValidationSummary.textContent = `Fehler: ${errorCount} | Warnungen: ${warnCount}`;
  } else if (warnCount > 0) {
    adminValidationSummary.textContent = `Warnungen: ${warnCount} | Schema ist nutzbar`;
  } else {
    adminValidationSummary.textContent = 'Schema OK';
  }

  adminValidationList.innerHTML = items.map((item) => `
    <li class="${item.level}"><strong>${item.level}</strong>${escapeHtml(item.message)}</li>
  `).join('');
};

const setSelectOptions = (selectNode, optionMap, allLabel = 'Alle') => {
  if (!selectNode) {
    return;
  }

  const currentValue = selectNode.value;
  const entries = Array.from(optionMap.entries()).sort((a, b) => a[1].localeCompare(b[1], 'de'));

  selectNode.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = allLabel;
  selectNode.append(allOption);

  entries.forEach(([key, label]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = label;
    selectNode.append(option);
  });

  const hasCurrent = currentValue === 'all' || entries.some(([key]) => key === currentValue);
  selectNode.value = hasCurrent ? currentValue : 'all';
};

const applyMemberFilters = () => {
  if (!memberCards.length || !memberSearch || !memberRank || !memberSpec || !memberSquad || !memberStatus) {
    return;
  }

  const query = normalizeValue(memberSearch.value);
  const rankFilter = memberRank.value;
  const specFilter = memberSpec.value;
  const squadFilter = memberSquad.value;
  const statusFilter = memberStatus.value;

  const currentState = { search: memberSearch.value, rank: rankFilter, spec: specFilter, squad: squadFilter, status: statusFilter };
  saveFilterState(currentState);

  let visibleCount = 0;

  memberCards.forEach((card) => {
    const text = normalizeValue(card.dataset.name);
    const rank = card.dataset.rank ?? '';
    const spec = card.dataset.spec ?? '';
    const squad = card.dataset.squad ?? '';
    const status = card.dataset.status ?? '';

    const matchesSearch = query.length === 0 || text.includes(query);
    const matchesRank = rankFilter === 'all' || rank === rankFilter;
    const matchesSpec = specFilter === 'all' || spec === specFilter;
    const matchesSquad = squadFilter === 'all' || squad === squadFilter;
    const matchesStatus = statusFilter === 'all' || status === statusFilter;

    const isVisible = matchesSearch && matchesRank && matchesSpec && matchesSquad && matchesStatus;
    
    if (card.hidden !== !isVisible) {
      card.hidden = !isVisible;
      card.setAttribute('aria-hidden', String(!isVisible));
    }

    if (isVisible) {
      visibleCount += 1;
    }
  });

  if (memberEmpty) {
    const isEmpty = visibleCount === 0;
    memberEmpty.hidden = !isEmpty;
    memberEmpty.setAttribute('aria-live', 'polite');
    memberEmpty.setAttribute('role', 'status');
  }
};

const debouncedFilterApply = debounce(applyMemberFilters, 180);

const sortMemberCards = (sortBy = 'name') => {
  if (!memberGrid || memberCards.length === 0) {
    return;
  }

  currentSortBy = sortBy;
  const sortedCards = [...memberCards].sort((a, b) => {
    let aVal = '';
    let bVal = '';

    switch (sortBy) {
      case 'rank':
        aVal = a.dataset.rank || '';
        bVal = b.dataset.rank || '';
        break;
      case 'squad':
        aVal = a.dataset.squad || '';
        bVal = b.dataset.squad || '';
        break;
      case 'status':
        aVal = a.dataset.status || '';
        bVal = b.dataset.status || '';
        break;
      default: // 'name'
        aVal = normalizeValue(a.dataset.name || '');
        bVal = normalizeValue(b.dataset.name || '');
    }

    return aVal.localeCompare(bVal, 'de');
  });

  memberGrid.innerHTML = '';
  sortedCards.forEach((card) => {
    memberGrid.appendChild(card);
  });

  memberCards = Array.from(memberGrid.querySelectorAll('.member-card'));
};

const renderMembers = (members) => {
  if (!memberGrid || !Array.isArray(members) || members.length === 0) {
    return;
  }

  const rankMap = new Map();
  const specMap = new Map();
  const squadMap = new Map();
  const statusMap = new Map();

  memberGrid.innerHTML = members.map((member) => {
    const rankLabel = String(member.rank ?? 'Unbekannt').trim();
    const specLabel = String(member.specialization ?? 'Unbekannt').trim();
    const squadLabel = String(member.squad ?? 'Unbekannt').trim();
    const statusLabel = String(member.status ?? 'active').trim();

    const rankKey = toFilterKey(rankLabel);
    const specKey = toFilterKey(specLabel);
    const squadKey = toFilterKey(squadLabel);
    const statusKey = toFilterKey(statusLabel);

    rankMap.set(rankKey, rankLabel);
    specMap.set(specKey, specLabel);
    squadMap.set(squadKey, squadLabel);
    statusMap.set(statusKey, statusLabel);

    const cardText = `${member.id ?? ''} ${member.callsign ?? ''} ${rankLabel} ${specLabel} ${squadLabel}`.trim();

    return `
      <article class="member-card" data-name="${escapeHtml(cardText)}" data-rank="${escapeHtml(rankKey)}" data-spec="${escapeHtml(specKey)}" data-squad="${escapeHtml(squadKey)}" data-status="${escapeHtml(statusKey)}" role="article">
        <h3>${escapeHtml(member.id ?? 'CT-0000')} "${escapeHtml(member.callsign ?? 'Unknown')}"</h3>
        <p class="member-rank">${escapeHtml(rankLabel)}</p>
        <p>${escapeHtml(specLabel)} | Squad ${escapeHtml(squadLabel)} | ${escapeHtml(member.description ?? 'Keine Beschreibung.')}</p>
        <p class="member-status ${statusClass(statusKey)}">${escapeHtml(statusLabel)}</p>
      </article>
    `;
  }).join('');

  memberCards = Array.from(memberGrid.querySelectorAll('.member-card'));

  setSelectOptions(memberRank, rankMap, 'Alle');
  setSelectOptions(memberSpec, specMap, 'Alle');
  setSelectOptions(memberSquad, squadMap, 'Alle');
  setSelectOptions(memberStatus, statusMap, 'Alle');

  applyMemberFilters();
  sortMemberCards(currentSortBy);

  if (sbActiveMembers) {
    const activeCount = members.filter((member) => toFilterKey(member.status) === 'active').length;
    sbActiveMembers.textContent = String(activeCount);
  }
};

const renderOperations = (operations) => {
  if (!calendarList || !Array.isArray(operations) || operations.length === 0) {
    return;
  }

  const now = new Date();
  const sorted = operations
    .map((op) => ({
      ...op,
      parsedDate: new Date(op.datetime),
    }))
    .sort((a, b) => a.parsedDate - b.parsedDate);

  let todayCount = 0;

  calendarList.innerHTML = sorted.map((op) => {
    const date = op.parsedDate;
    const participants = Number(op.participants ?? 0);
    const capacity = Number(op.capacity ?? 0);
    const state = resolveOperationState(date, participants, capacity, now);
    const today = date instanceof Date && !Number.isNaN(date.getTime()) && isSameLocalDay(date, now);

    if (today) {
      todayCount += 1;
    }

    return `
      <article class="calendar-item ${today ? 'is-today' : ''}" data-today="${today}" data-state="${state}">
        <p class="cal-meta">${escapeHtml(today ? `Heute | ${formatOperationDate(date)}` : formatOperationDate(date))}</p>
        <h3>${escapeHtml(op.title ?? 'Unbekannter Einsatz')}</h3>
        <p>${escapeHtml(op.description ?? 'Keine Beschreibung.')}</p>
        <span class="cal-state ${operationStateClass(state)}">${operationStateLabel(state)}</span>
      </article>
    `;
  }).join('');

  if (sbTodayOps) {
    sbTodayOps.textContent = String(todayCount);
  }
};

const renderMedals = (medals) => {
  if (!medalGrid || !Array.isArray(medals) || medals.length === 0) {
    return;
  }

  medalGrid.innerHTML = medals.map((medal) => {
    const ribbonTierClass = `ribbon-tier-${sanitizeTier(medal.tier)}`;

    return `
    <article class="medal-card medal-ribbon ${ribbonTierClass}">
      <div class="medal-ribbon-head">
        <span class="medal-tier tier-${sanitizeTier(medal.tier)}">${escapeHtml(medal.tier ?? 'standard')}</span>
        <p class="medal-icon">${escapeHtml(medal.icon ?? '36')}</p>
      </div>
      <div class="medal-ribbon-body">
        <h3>${escapeHtml(medal.title ?? 'Unbekannte Auszeichnung')}</h3>
        <p>${escapeHtml(medal.description ?? 'Keine Beschreibung.')}</p>
      </div>
    </article>
  `;
  }).join('');
};

const renderTrailer = (trailer) => {
  if (trailerCrawlViewport || trailerCrawlCopy) {
    if (trailerTitle && trailer?.title) {
      trailerTitle.textContent = trailer.title;
    }

    if (trailerSub && trailer?.subtitle) {
      trailerSub.textContent = trailer.subtitle;
    }

    if (trailerCrawlCopy) {
      const crawlParagraphs = Array.isArray(trailer?.crawlParagraphs) && trailer.crawlParagraphs.length > 0
        ? trailer.crawlParagraphs
        : [
            'Die 36th Storm Corps betritt den Krieg nicht als Legende, sondern als praezise republikanische Einsatzformation.',
            'Seit Geonosis steht die Einheit fuer Disziplin, saubere Befehlswege und schnelle Reaktion unter Druck.',
            'Was im Schatten beginnt, endet in klaren Ergebnissen: sichern, markieren, absichern, durchziehen.',
          ];

      trailerCrawlCopy.innerHTML = crawlParagraphs
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join('');
    }

    return;
  }

  if (!trailerYoutube || !trailerVideo || !trailerMp4Source || !trailerPoster) {
    return;
  }

  const youtubeUrl = toYouTubeEmbedUrl(trailer?.youtubeUrl);
  const mp4Url = String(trailer?.mp4Url ?? '').trim();
  const posterUrl = String(trailer?.posterUrl ?? '').trim();
  const mode = toFilterKey(trailer?.mode || 'youtube-first');
  setModeButtonState(mode);

  if (trailerTitle && trailer?.title) {
    trailerTitle.textContent = trailer.title;
  }

  if (trailerSub && trailer?.subtitle) {
    trailerSub.textContent = trailer.subtitle;
  }

  trailerYoutube.hidden = true;
  trailerVideo.hidden = true;
  trailerPoster.hidden = true;

  const showYouTube = () => {
    if (!youtubeUrl) {
      return false;
    }

    trailerYoutube.src = youtubeUrl;
    trailerYoutube.hidden = false;
    return true;
  };

  const showMp4 = () => {
    if (!mp4Url) {
      return false;
    }

    trailerMp4Source.src = mp4Url;
    trailerVideo.poster = posterUrl;
    trailerVideo.load();
    trailerVideo.hidden = false;
    return true;
  };

  const showPoster = () => {
    if (!posterUrl) {
      return false;
    }

    trailerPoster.src = posterUrl;
    trailerPoster.hidden = false;
    return true;
  };

  if (mode === 'poster-only') {
    showPoster();
    return;
  }

  if (mode === 'mp4-first') {
    if (showMp4() || showYouTube() || showPoster()) {
      return;
    }
    return;
  }

  showYouTube() || showMp4() || showPoster();
};

const applyStatusboardMeta = (statusboard) => {
  if (!statusboard) {
    return;
  }

  if (sbReadiness && statusboard.readiness) {
    sbReadiness.textContent = statusboard.readiness;
  }

  if (sbChannel && statusboard.channel) {
    sbChannel.textContent = statusboard.channel;
  }
};

const loadAdminData = async () => {
  if (window.location.protocol === 'file:') {
    return { data: ADMIN_SCHEMA_EXAMPLE, raw: JSON.stringify(ADMIN_SCHEMA_EXAMPLE, null, 2), errors: [] };
  }

  try {
    const response = await fetch('./admin-data.json', { cache: 'no-store' });
    if (!response.ok) {
      return { data: ADMIN_SCHEMA_EXAMPLE, raw: JSON.stringify(ADMIN_SCHEMA_EXAMPLE, null, 2), errors: [] };
    }

    const raw = await response.text();

    try {
      const data = JSON.parse(raw);
      return { data, raw, errors: [] };
    } catch {
      return { data: ADMIN_SCHEMA_EXAMPLE, raw: JSON.stringify(ADMIN_SCHEMA_EXAMPLE, null, 2), errors: [] };
    }
  } catch {
    return { data: ADMIN_SCHEMA_EXAMPLE, raw: JSON.stringify(ADMIN_SCHEMA_EXAMPLE, null, 2), errors: [] };
  }
};

const writeAdminEditor = (rawText, parsedData) => {
  if (adminJsonEditor && rawText) {
    adminJsonEditor.value = rawText;
  } else if (adminJsonEditor && parsedData) {
    adminJsonEditor.value = JSON.stringify(parsedData, null, 2);
  }
};

const parseEditorJson = () => {
  if (!adminJsonEditor) {
    return { data: null, errors: [{ level: 'error', message: 'Editor ist nicht verfuegbar.' }] };
  }

  try {
    const data = JSON.parse(adminJsonEditor.value);
    return { data, errors: [] };
  } catch {
    return { data: null, errors: [{ level: 'error', message: 'JSON Parse Error im Inline-Editor.' }] };
  }
};

const applyDataToUi = (data) => {
  applyUiConfig(data.ui);
  renderTrailer(data.trailer);
  renderMembers(data.members);
  renderOperations(data.operations);
  renderMedals(data.medals);
  applyStatusboardMeta(data.statusboard);
};

const downloadEditorJson = () => {
  if (!adminJsonEditor) {
    return;
  }

  const blob = new Blob([adminJsonEditor.value], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'admin-data.json';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const closeMenus = () => {
  if (menuToggle && mainNav) {
    menuToggle.setAttribute('aria-expanded', 'false');
    mainNav.classList.remove('open');
  }

  if (navDropdown && dropdownToggle) {
    navDropdown.classList.remove('open');
    dropdownToggle.setAttribute('aria-expanded', 'false');
  }
};

const setActiveNavLinks = () => {
  if (!mainNav) {
    return;
  }

  const path = window.location.pathname.split('/').pop() || 'index.html';
  const hash = window.location.hash;

  mainNav.querySelectorAll('a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    let isActive = false;

    if (href.startsWith('#')) {
      isActive = hash.length > 0 && href === hash;
    } else {
      isActive = href === path;
    }

    link.classList.toggle('is-active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
};

const getScrollSpySection = () => {
  const sections = Array.from(document.querySelectorAll('main section[id]'));
  const viewportOffset = window.innerHeight * 0.28;

  return sections.reduce((bestSection, section) => {
    const rect = section.getBoundingClientRect();
    const distance = Math.abs(rect.top - viewportOffset);

    if (!bestSection || distance < bestSection.distance) {
      return { section, distance };
    }

    return bestSection;
  }, null)?.section ?? null;
};

const syncHeaderState = () => {
  if (!document.body) {
    return;
  }

  const scrolled = window.scrollY > 14;
  document.body.classList.toggle('has-scrolled', scrolled);
  const header = document.querySelector('.site-header');
  if (header) {
    header.classList.toggle('is-scrolled', scrolled);
  }
};

const updateScrollSpy = () => {
  scrollSpyRaf = null;

  const section = getScrollSpySection();
  if (!section || scrollSpySection === section) {
    return;
  }

  scrollSpySection = section;
  const hash = `#${section.id}`;

  if (!mainNav) {
    return;
  }

  mainNav.querySelectorAll('a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const isActive = href === hash;
    link.classList.toggle('is-active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
};

const requestScrollSpyUpdate = () => {
  if (scrollSpyRaf !== null) {
    return;
  }

  scrollSpyRaf = window.requestAnimationFrame(updateScrollSpy);
};

if (adminSchema) {
  adminSchema.textContent = JSON.stringify(ADMIN_SCHEMA_EXAMPLE, null, 2);
}

ensureThemeSwitcher();
applyTheme(getStoredTheme() || 'tactical', false);
applySectionIcons();
initPageTransitions();
syncHeaderState();
requestScrollSpyUpdate();

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

if (briefingScreen && briefingEnter) {
  let briefingHideTimer = null;
  let briefingExitTimer = null;
  let briefingMusicTimer = null;
  let briefingMusicFadeTimer = null;
  let briefingMusicStarted = false;
  let briefingMusicRetryBound = false;
  let briefingSfxEnabled = false;
  let briefingAudioContext = null;

  const setBriefingAudioHintVisible = (isVisible) => {
    if (!briefingAudioHint) {
      return;
    }

    briefingAudioHint.hidden = !isVisible;
  };

  const stopBriefingMusic = () => {
    if (!briefingMusic) {
      return;
    }

    if (briefingMusicFadeTimer) {
      window.clearInterval(briefingMusicFadeTimer);
      briefingMusicFadeTimer = null;
    }

    briefingMusic.volume = 1;
    briefingMusic.pause();
    briefingMusic.currentTime = 0;
    briefingMusicStarted = false;
    setBriefingAudioHintVisible(false);

    if (briefingMusicTimer) {
      window.clearTimeout(briefingMusicTimer);
      briefingMusicTimer = null;
    }

    briefingMusicRetryBound = false;
  };

  const startBriefingMusic = async () => {
    if (!briefingMusic || briefingMusicStarted || briefingScreen.classList.contains('hidden')) {
      return;
    }

    try {
      if (briefingMusicFadeTimer) {
        window.clearInterval(briefingMusicFadeTimer);
        briefingMusicFadeTimer = null;
      }

      briefingMusic.currentTime = 0;
      briefingMusic.volume = 0;
      const playback = briefingMusic.play();
      if (playback && typeof playback.catch === 'function') {
        await playback;
      }
      briefingMusicStarted = true;
      briefingMusicRetryBound = false;
      setBriefingAudioHintVisible(false);

      const targetVolume = 0.9;
      const fadeDurationMs = 2000;
      const fadeStepMs = 50;
      const fadeStep = targetVolume / (fadeDurationMs / fadeStepMs);

      briefingMusicFadeTimer = window.setInterval(() => {
        if (!briefingMusic || briefingMusic.paused) {
          if (briefingMusicFadeTimer) {
            window.clearInterval(briefingMusicFadeTimer);
            briefingMusicFadeTimer = null;
          }
          return;
        }

        briefingMusic.volume = Math.min(targetVolume, briefingMusic.volume + fadeStep);

        if (briefingMusic.volume >= targetVolume) {
          briefingMusic.volume = targetVolume;
          if (briefingMusicFadeTimer) {
            window.clearInterval(briefingMusicFadeTimer);
            briefingMusicFadeTimer = null;
          }
        }
      }, fadeStepMs);
    } catch {
      briefingMusic.volume = 1;
      briefingMusicStarted = false;
      if (!briefingMusicRetryBound) {
        briefingMusicRetryBound = true;
        setBriefingAudioHintVisible(true);
        const retryBriefingMusic = () => {
          briefingMusicRetryBound = false;
          void startBriefingMusic();
        };

        document.addEventListener('pointerdown', retryBriefingMusic, { once: true, passive: true });
        document.addEventListener('keydown', retryBriefingMusic, { once: true });
      }
    }
  };

  const playBriefingSfx = (type) => {
    if (!briefingSfxEnabled) {
      return;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    try {
      briefingAudioContext = briefingAudioContext || new AudioContextCtor();
      if (briefingAudioContext.state === 'suspended') {
        void briefingAudioContext.resume();
      }

      const now = briefingAudioContext.currentTime;
      const oscillator = briefingAudioContext.createOscillator();
      const gainNode = briefingAudioContext.createGain();

      if (type === 'skip') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(320, now);
        oscillator.frequency.exponentialRampToValueAtTime(190, now + 0.2);
      } else {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(250, now);
        oscillator.frequency.exponentialRampToValueAtTime(390, now + 0.2);
      }

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

      oscillator.connect(gainNode);
      gainNode.connect(briefingAudioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.25);
    } catch {
      // Ignore audio API restrictions.
    }
  };

  const hideBriefing = (reason = 'auto') => {
    if (briefingScreen.classList.contains('hidden')) {
      return;
    }

    stopBriefingMusic();
    document.body.classList.add('intro-exit');
    briefingScreen.classList.add('hidden');
    playBriefingSfx(reason === 'skip' ? 'skip' : 'close');

    if (briefingHideTimer) {
      window.clearTimeout(briefingHideTimer);
      briefingHideTimer = null;
    }

    if (briefingExitTimer) {
      window.clearTimeout(briefingExitTimer);
    }

    briefingExitTimer = window.setTimeout(() => {
      document.body.classList.remove('intro-active');
      document.body.classList.remove('intro-exit');
      setBriefingAudioHintVisible(false);
    }, 460);
  };

  if (briefingCrawlCopy) {
    briefingCrawlCopy.addEventListener('animationend', () => hideBriefing('auto'), { once: true });
    briefingHideTimer = window.setTimeout(() => hideBriefing('auto'), 36000);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        void startBriefingMusic();
      });
    });
  }

  briefingEnter.addEventListener('click', () => hideBriefing('skip'));

  if (briefingSoundToggle) {
    briefingSoundToggle.addEventListener('click', () => {
      briefingSfxEnabled = !briefingSfxEnabled;
      briefingSoundToggle.setAttribute('aria-pressed', String(briefingSfxEnabled));
      briefingSoundToggle.textContent = briefingSfxEnabled ? 'SFX: ON' : 'SFX: OFF';
      playBriefingSfx('skip');
    });
  }
}

if (navDropdown && dropdownToggle) {
  dropdownToggle.addEventListener('click', () => {
    const isOpen = navDropdown.classList.toggle('open');
    dropdownToggle.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', (event) => {
    if (!navDropdown.contains(event.target)) {
      navDropdown.classList.remove('open');
      dropdownToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', () => {
    const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!isExpanded));
    mainNav.classList.toggle('open');
  });

  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      mainNav.classList.remove('open');
      if (navDropdown && dropdownToggle) {
        navDropdown.classList.remove('open');
        dropdownToggle.setAttribute('aria-expanded', 'false');
      }
      setActiveNavLinks();
    });
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMenus();
  }
});

window.addEventListener('hashchange', setActiveNavLinks);
setActiveNavLinks();

window.addEventListener('scroll', () => {
  syncHeaderState();
  requestScrollSpyUpdate();
}, { passive: true });

window.addEventListener('resize', () => {
  syncHeaderState();
  requestScrollSpyUpdate();
  closeMenus();
}, { passive: true });

if (memberSearch && memberRank && memberSpec && memberSquad && memberStatus) {
  [memberSearch, memberRank, memberSpec, memberSquad, memberStatus].forEach((control) => {
    control.addEventListener('input', debouncedFilterApply);
    control.addEventListener('change', applyMemberFilters);
  });

  // Keyboard navigation enhancement: Reset filters with Escape
  memberSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && memberSearch.value) {
      memberSearch.value = '';
      memberSearch.focus();
      applyMemberFilters();
    }
  });

  restoreFilterState();
  applyMemberFilters();
}

const fallbackTodayOps = () => {
  if (!sbTodayOps) {
    return;
  }

  const currentCalendarItems = Array.from(document.querySelectorAll('.calendar-item'));
  const todayOps = currentCalendarItems.filter((item) => item.dataset.today === 'true').length;
  sbTodayOps.textContent = String(todayOps);
};

if (sbActiveMembers && memberCards.length > 0) {
  const activeCount = memberCards.filter((card) => card.dataset.status === 'active').length;
  sbActiveMembers.textContent = String(activeCount);
}

fallbackTodayOps();

void (async () => {
  const report = await loadAdminData();

  if (report.errors.length > 0) {
    renderValidationOutput(report.errors.map((msg) => ({ level: 'error', message: msg })));
    return;
  }

  const data = report.data;

  if (!data) {
    renderValidationOutput([{ level: 'error', message: 'admin-data.json konnte nicht gelesen werden.' }]);
    return;
  }

  const validationItems = validateAdminData(data);
  renderValidationOutput(validationItems);
  writeAdminEditor(report.raw, data);

  if (validationItems.some((item) => item.level === 'error')) {
    return;
  }

  currentAdminData = data;
  applyDataToUi(data);
})();

if (adminValidateBtn) {
  adminValidateBtn.addEventListener('click', () => {
    const parsed = parseEditorJson();
    if (parsed.errors.length > 0) {
      renderValidationOutput(parsed.errors);
      return;
    }

    const validationItems = validateAdminData(parsed.data);
    renderValidationOutput(validationItems);
  });
}

if (adminApplyBtn) {
  adminApplyBtn.addEventListener('click', () => {
    const parsed = parseEditorJson();
    if (parsed.errors.length > 0) {
      renderValidationOutput(parsed.errors);
      return;
    }

    const validationItems = validateAdminData(parsed.data);
    renderValidationOutput(validationItems);
    if (validationItems.some((item) => item.level === 'error')) {
      return;
    }

    currentAdminData = parsed.data;
    applyDataToUi(parsed.data);
  });
}

if (adminDownloadBtn) {
  adminDownloadBtn.addEventListener('click', downloadEditorJson);
}

if (trailerModeButtons.length > 0) {
  trailerModeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode;
      if (!mode || !currentAdminData?.trailer) {
        return;
      }

      const previewData = {
        ...currentAdminData,
        trailer: {
          ...currentAdminData.trailer,
          mode,
        },
      };

      renderTrailer(previewData.trailer);
    });
  });
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.18,
    rootMargin: '0px 0px -60px 0px',
  }
);

revealSections.forEach((section) => {
  revealObserver.observe(section);
});
