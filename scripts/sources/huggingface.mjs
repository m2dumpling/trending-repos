import { fetchJson, fetchText, mapLimit, repoFromUrl, repoKey, sourceRecord, clamp } from './common.mjs';

const HUB_ROOT = 'https://huggingface.co/api';
const RAW_ROOT = 'https://huggingface.co';
const LIMIT = Number(process.env.HF_LIMIT || 80);
const HF_TOKEN = process.env.HF_TOKEN || '';

function headers() {
  return {
    Accept: 'application/json',
    'User-Agent': 'repo-radar/1.0 (+public-project)',
    ...(HF_TOKEN ? { Authorization: 'Bearer ' + HF_TOKEN } : {}),
  };
}

function githubLinksFromValue(value, output = []) {
  if (typeof value === 'string') {
    const matches = value.match(/https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:[^"'<>\\s)]*)?/gi) || [];
    for (const link of matches) {
      const repoName = repoFromUrl(link);
      if (repoName) output.push({ repoName, link });
    }
  } else if (Array.isArray(value)) {
    for (const item of value) githubLinksFromValue(item, output);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) githubLinksFromValue(item, output);
  }
  return output;
}

function itemScore(item) {
  const downloads = Number(item.downloads || 0);
  const likes = Number(item.likes || 0);
  const trending = Number(item.trendingScore || 0);
  return clamp(
    Math.log1p(downloads) * 7 +
      Math.log1p(likes) * 13 +
      Math.min(25, Math.max(0, trending)),
    0,
    100,
  );
}

async function readCard(item, kind) {
  const fromCard = githubLinksFromValue(item.cardData || item);
  if (fromCard.length) return fromCard;
  if (!item.id) return [];
  try {
    const markdown = await fetchText(RAW_ROOT + '/' + item.id + '/raw/main/README.md', {
      headers: { Accept: 'text/plain', 'User-Agent': 'repo-radar/1.0 (+public-project)' },
    });
    return githubLinksFromValue(markdown);
  } catch (error) {
    return [];
  }
}

async function readEndpoint(kind) {
  const url = HUB_ROOT + '/' + kind + '?sort=trendingScore&direction=-1&limit=' + LIMIT;
  return fetchJson(url, { headers: headers() });
}

export async function fetchHuggingFaceSignals() {
  const failures = [];
  const entries = [];
  for (const kind of ['models', 'spaces']) {
    try {
      const items = await readEndpoint(kind);
      for (const item of (items || []).slice(0, LIMIT)) entries.push({ item, kind });
    } catch (error) {
      failures.push({ resource: kind, error: error.message });
    }
  }

  const byRepo = new Map();
  await mapLimit(entries, 12, async (entry) => {
    const links = await readCard(entry.item, entry.kind);
    for (const link of links) {
      const key = repoKey(link.repoName);
      const existing = byRepo.get(key) || {
        repoName: link.repoName,
        score: 0,
        items: [],
        links: new Set(),
      };
      existing.score = Math.max(existing.score, itemScore(entry.item));
      existing.items.push({
        kind: entry.kind,
        id: entry.item.id || '',
        likes: Number(entry.item.likes || 0),
        downloads: Number(entry.item.downloads || 0),
        trendingScore: Number(entry.item.trendingScore || 0),
      });
      existing.links.add(RAW_ROOT + '/' + (entry.item.id || ''));
      byRepo.set(key, existing);
    }
  });

  const signals = new Map();
  for (const [key, value] of byRepo.entries()) {
    signals.set(key, sourceRecord(
      'huggingface',
      value.score,
      {
        repoName: value.repoName,
        items: value.items.slice(0, 5),
        links: [...value.links].slice(0, 3),
      },
      [...value.links][0] || null,
      new Date().toISOString(),
    ));
  }

  return {
    source: 'huggingface',
    signals,
    stats: {
      entriesRead: entries.length,
      repositoriesMentioned: signals.size,
      failures: failures.length,
    },
    failures,
  };
}
