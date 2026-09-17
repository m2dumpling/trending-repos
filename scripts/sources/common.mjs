export async function fetchText(url, init = {}) {
  const response = await fetch(url, {
    redirect: 'follow',
    ...init,
  });
  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' for ' + url);
  }
  return response.text();
}

export async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', ...(init.headers || {}) },
    redirect: 'follow',
    ...init,
  });
  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' for ' + url);
  }
  return response.json();
}

export async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, worker),
  );
  return results;
}

export function repoKey(value) {
  return String(value || '').trim().toLowerCase();
}

export function repoFromUrl(value) {
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    return null;
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname !== 'github.com' && hostname !== 'www.github.com') return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const blockedOwners = new Set([
    'topics', 'settings', 'marketplace', 'sponsors', 'collections', 'orgs',
    'users', 'search', 'login', 'signup', 'features', 'enterprise',
  ]);
  if (blockedOwners.has(parts[0].toLowerCase())) return null;
  const owner = parts[0];
  const repository = parts[1].replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repository)) {
    return null;
  }
  return owner + '/' + repository;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function sourceRecord(source, score, raw, url, observedAt) {
  return {
    source,
    score: Math.round(clamp(score, 0, 100) * 10) / 10,
    raw: raw || {},
    url: url || null,
    observedAt: observedAt || new Date().toISOString(),
  };
}
