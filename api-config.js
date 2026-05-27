(function () {
  const API_BASE_STORAGE_KEY = 'stormcorps36_api_base';
  const DEFAULT_API_BASES = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
  const REQUEST_TIMEOUT_MS = 12000;

  const unique = (values) => Array.from(new Set(values.filter(Boolean)));
  const normalizeBase = (value) => String(value || '').trim().replace(/\/$/, '');

  const isLocalHostname = (hostname) => {
    const normalized = String(hostname || '').trim().toLowerCase();
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]';
  };

  const isLocalBase = (base) => {
    try {
      const parsed = new URL(normalizeBase(base));
      return isLocalHostname(parsed.hostname);
    } catch (_) {
      return false;
    }
  };

  const isSameOriginBase = (base) => normalizeBase(base) === normalizeBase(window.location.origin);

  const isBaseAllowedInContext = (base, isLocalContext) => {
    if (!base) {
      return false;
    }

    // Never call localhost from deployed origins to avoid CORS and mixed-context failures.
    if (!isLocalContext && isLocalBase(base)) {
      return false;
    }

    return true;
  };

  const getApiCandidates = (extraBases) => {
    const candidates = [];
    const isLocalContext = window.location.protocol === 'file:' || isLocalHostname(window.location.hostname);
    const includeLocalDefaults = isLocalContext;

    try {
      const stored = window.localStorage.getItem(API_BASE_STORAGE_KEY);
      if (stored && isBaseAllowedInContext(stored, isLocalContext)) {
        candidates.push(stored.trim());
      } else if (stored) {
        window.localStorage.removeItem(API_BASE_STORAGE_KEY);
      }
    } catch (_) {
      // Ignore storage restrictions.
    }

    if (window.location.origin && window.location.origin !== 'null') {
      // For deployed environments (Railway), same-origin API is the primary source.
      candidates.push(window.location.origin);
    }

    if (includeLocalDefaults) {
      candidates.push(...DEFAULT_API_BASES);
    }

    if (Array.isArray(extraBases) && extraBases.length) {
      candidates.push(...extraBases);
    }

    return unique(candidates).filter((base) => isBaseAllowedInContext(base, isLocalContext));
  };

  const withApiBase = (base, route) => {
    const normalizedBase = String(base || '').replace(/\/$/, '');
    if (!normalizedBase) {
      return route;
    }

    return `${normalizedBase}${route}`;
  };

  const apiFetchRaw = async (route, options = {}, extraBases = []) => {
    const isLocalContext = window.location.protocol === 'file:' || isLocalHostname(window.location.hostname);
    const candidates = getApiCandidates(extraBases);
    let lastError = null;

    for (const base of candidates) {
      if (!isBaseAllowedInContext(base, isLocalContext)) {
        continue;
      }

      const requestUrl = withApiBase(base, route);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(requestUrl, {
          credentials: 'include',
          signal: controller.signal,
          ...options,
        });

        window.clearTimeout(timeoutId);

        if (response.status === 404) {
          lastError = new Error(`Route not found on ${base}`);
          continue;
        }

        try {
          if (isSameOriginBase(base) || isLocalBase(base)) {
            window.localStorage.setItem(API_BASE_STORAGE_KEY, base);
          }
        } catch (_) {
          // Ignore storage restrictions.
        }

        return response;
      } catch (error) {
        window.clearTimeout(timeoutId);
        lastError = error;
      }
    }

    throw lastError || new Error('Portal API ist nicht erreichbar.');
  };

  window.StormCorpsApi = {
    API_BASE_STORAGE_KEY,
    DEFAULT_API_BASES,
    REQUEST_TIMEOUT_MS,
    getApiCandidates,
    withApiBase,
    apiFetchRaw,
  };
})();
