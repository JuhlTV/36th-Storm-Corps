(function () {
  const API_BASE_STORAGE_KEY = 'stormcorps36_api_base';
  const DEFAULT_API_BASES = [
    'https://36th-storm-corps-production.up.railway.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  const unique = (values) => Array.from(new Set(values.filter(Boolean)));

  const getApiCandidates = (extraBases) => {
    const candidates = [];

    try {
      const stored = window.localStorage.getItem(API_BASE_STORAGE_KEY);
      if (stored) {
        candidates.push(stored.trim());
      }
    } catch (_) {
      // Ignore storage restrictions.
    }

    if (window.location.origin && window.location.origin !== 'null') {
      candidates.push(window.location.origin);
    }

    candidates.push(...DEFAULT_API_BASES);

    if (Array.isArray(extraBases) && extraBases.length) {
      candidates.push(...extraBases);
    }

    return unique(candidates);
  };

  const withApiBase = (base, route) => {
    const normalizedBase = String(base || '').replace(/\/$/, '');
    if (!normalizedBase) {
      return route;
    }

    return `${normalizedBase}${route}`;
  };

  const apiFetchRaw = async (route, options = {}, extraBases = []) => {
    const candidates = getApiCandidates(extraBases);
    let lastError = null;

    for (const base of candidates) {
      const requestUrl = withApiBase(base, route);

      try {
        const response = await fetch(requestUrl, {
          credentials: 'include',
          ...options,
        });

        if (response.status === 404) {
          lastError = new Error(`Route not found on ${base}`);
          continue;
        }

        try {
          window.localStorage.setItem(API_BASE_STORAGE_KEY, base);
        } catch (_) {
          // Ignore storage restrictions.
        }

        return response;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Portal API ist nicht erreichbar.');
  };

  window.StormCorpsApi = {
    API_BASE_STORAGE_KEY,
    DEFAULT_API_BASES,
    getApiCandidates,
    withApiBase,
    apiFetchRaw,
  };
})();
