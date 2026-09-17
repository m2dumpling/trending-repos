#!/usr/bin/env node

/**
 * Discover and rank the two static boards used by the GitHub Pages site.
 *
 * The important distinction from the original OSSInsight implementation is
 * that collection YAML files are seed examples, not the live membership list.
 * Every run discovers candidates globally through GitHub Search, reads their
 * metadata and README, classifies them with the versioned taxonomy, then
 * records a daily star snapshot for velocity ranking.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachExternalSignals, calculateAttention, summarizeSources } from './sources/attention.mjs';
import { fetchDockerSignals } from './sources/docker.mjs';
import { fetchHackerNewsSignals } from './sources/hacker-news.mjs';
import { fetchHelloGitHubSignals } from './sources/hellogithub.mjs';
import { fetchHuggingFaceSignals } from './sources/huggingface.mjs';
import { fetchNpmSignals } from './sources/npm.mjs';
import { fetchPypiSignals } from './sources/pypi.mjs';
import { repoKey } from './sources/common.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLLECTIONS_ROOT = path.join(PROJECT_ROOT, 'data', 'collections');
const TAXONOMY_PATH = path.join(PROJECT_ROOT, 'data', 'taxonomy.json');
const DATA_ROOT = path.join(PROJECT_ROOT, 'data');
const SNAPSHOTS_PATH = path.join(DATA_ROOT, 'snapshots.json');
const OUTPUT_PATH = path.join(DATA_ROOT, 'repos.json');
const GITHUB_API = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const SOURCE_REPOSITORY = process.env.SOURCE_REPOSITORY || '';
const SNAPSHOT_DATE = process.env.SNAPSHOT_DATE || new Date().toISOString().slice(0, 10);
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const SEARCH_DAYS = Number(process.env.SEARCH_DAYS || 120);
const MIN_SEARCH_STARS = Number(process.env.MIN_SEARCH_STARS || (TOKEN ? 5 : 20));
const READMEs_ENABLED = process.env.FETCH_READMES === 'false' ? false : Boolean(TOKEN);
const MAX_README_CHARS = 16000;
const DEFAULT_AI_CANDIDATE_LIMIT = TOKEN ? 800 : 45;

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fff\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCollection(text) {
  const nameMatch = text.match(/^name:\s*(.+)$/m);
  const items = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s+-\s+(.+?)\s*$/);
    if (!match) continue;
    const candidate = match[1].trim().replace(/^['"]|['"]$/g, '');
    if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(candidate)) {
      items.push(candidate);
    }
  }
  return {
    name: nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '') : '',
    items: [...new Set(items)],
  };
}

async function loadCatalog() {
  const taxonomy = await readJson(TAXONOMY_PATH, { version: 1, categories: [] });
  const categories = (taxonomy.categories || []).map((category) => ({
    ...category,
    aliases: Array.isArray(category.aliases) ? category.aliases : [],
    discoveryTopics: Array.isArray(category.discoveryTopics) ? category.discoveryTopics : [],
    strongTopics: Array.isArray(category.strongTopics) ? category.strongTopics : [],
    signals: Array.isArray(category.signals) ? category.signals : [],
    negativeSignals: Array.isArray(category.negativeSignals) ? category.negativeSignals : [],
    sources: Array.isArray(category.sources) ? category.sources : [],
    threshold: Number(category.threshold || 5.5),
  }));
  const repoMeta = new Map();
  const warnings = [];

  for (const category of categories) {
    for (const source of category.sources) {
      const filePath = path.join(COLLECTIONS_ROOT, source.file);
      let collection;
      try {
        collection = parseCollection(await readFile(filePath, 'utf8'));
      } catch (error) {
        warnings.push('Missing seed collection file: ' + source.file);
        continue;
      }
      for (const repoName of collection.items) {
        const existing = repoMeta.get(repoName) || { seedCategories: [], sourceNames: [] };
        if (!existing.seedCategories.includes(category.key)) existing.seedCategories.push(category.key);
        if (!existing.sourceNames.includes(repoName)) existing.sourceNames.push(repoName);
        repoMeta.set(repoName, existing);
      }
    }
  }
  return { taxonomyVersion: Number(taxonomy.version || 1), categories, repoMeta, warnings };
}

function requestHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': 'ai-repo-pulse',
    ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}),
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: requestHeaders(),
    redirect: 'follow',
  });
  if (!response.ok) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const suffix = remaining === '0' ? ' (GitHub API rate limit reached)' : '';
    throw new Error('GitHub API ' + response.status + ' for ' + url + suffix);
  }
  return response.json();
}

function normalizeRepository(raw) {
  const name = raw.full_name || raw.nameWithOwner;
  if (!name) throw new Error('GitHub response has no repository name');
  return {
    id: Number(raw.id || raw.databaseId) || null,
    name,
    url: raw.html_url || raw.url || 'https://github.com/' + name,
    homepage: raw.homepage || '',
    description: raw.description || '',
    language: raw.language || (raw.primaryLanguage && raw.primaryLanguage.name) || '',
    stars: Number(raw.stargazers_count || raw.stargazerCount || 0),
    forks: Number(raw.forks_count || raw.forkCount || 0),
    watchers: Number(raw.watchers_count || 0),
    openIssues: Number(raw.open_issues_count || 0),
    createdAt: raw.created_at || raw.createdAt || null,
    updatedAt: raw.updated_at || raw.updatedAt || null,
    pushedAt: raw.pushed_at || raw.pushedAt || null,
    defaultBranch: raw.default_branch || raw.defaultBranch || 'main',
    archived: Boolean(raw.archived || raw.isArchived),
    fork: Boolean(raw.fork || raw.isFork),
    disabled: Boolean(raw.disabled),
    license: raw.license && (raw.license.spdx_id || raw.license.name)
      ? (raw.license.spdx_id || raw.license.name)
      : '',
    topics: Array.isArray(raw.topics) ? raw.topics.slice(0, 20) : [],
    avatarUrl: raw.owner && raw.owner.avatar_url
      ? raw.owner.avatar_url
      : 'https://github.com/' + name.split('/')[0] + '.png?size=80',
  };
}

async function mapLimit(items, limit, mapper) {
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
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, worker));
  return results;
}

function daysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function addCandidate(map, repository, categoryKey, discoverySource) {
  if (repository.archived || repository.fork || repository.disabled) return;
  const key = repository.id ? 'id:' + repository.id : 'name:' + repository.name;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      repository,
      sourceNames: [repository.name],
      candidateCategories: categoryKey ? [categoryKey] : [],
      discoverySources: discoverySource ? [discoverySource] : [],
    });
    return;
  }
  if (categoryKey && !existing.candidateCategories.includes(categoryKey)) {
    existing.candidateCategories.push(categoryKey);
  }
  if (discoverySource && !existing.discoverySources.includes(discoverySource)) {
    existing.discoverySources.push(discoverySource);
  }
}

async function discoverAiCandidates(catalog) {
  const plan = [];
  for (const category of catalog.categories) {
    for (const topic of category.discoveryTopics.slice(0, 2)) {
      plan.push({
        categoryKey: category.key,
        kind: 'topic',
        query: 'topic:' + topic + ' stars:>=' + MIN_SEARCH_STARS +
          ' pushed:>=' + daysAgo(SEARCH_DAYS) + ' archived:false',
        sort: 'updated',
      });
    }
    const alias = category.aliases[0];
    if (alias) {
      plan.push({
        categoryKey: category.key,
        kind: 'text',
        query: '"' + alias + '" in:name,description,readme,topics stars:>=' + MIN_SEARCH_STARS +
          ' pushed:>=' + daysAgo(SEARCH_DAYS) + ' archived:false',
        sort: 'stars',
      });
    }
  }

  // A few broad queries catch projects whose maintainers have not added
  // useful Topics yet. They are intentionally unlabelled; the classifier
  // decides whether the repository is actually AI-related.
  plan.push(
    {
      categoryKey: null,
      kind: 'global-ai',
      query: '("artificial intelligence" OR llm OR agent) stars:>=' + MIN_SEARCH_STARS +
        ' pushed:>=' + daysAgo(SEARCH_DAYS) + ' archived:false',
      sort: 'updated',
    },
    {
      categoryKey: null,
      kind: 'global-ai',
      query: '("generative ai" OR "machine learning") stars:>=' + MIN_SEARCH_STARS +
        ' pushed:>=' + daysAgo(SEARCH_DAYS) + ' archived:false',
      sort: 'stars',
    },
    {
      categoryKey: null,
      kind: 'global-ai',
      query: '("open source ai" OR "language model") stars:>=' + MIN_SEARCH_STARS +
        ' pushed:>=' + daysAgo(SEARCH_DAYS) + ' archived:false',
      sort: 'updated',
    },
  );

  const selectedPlan = TOKEN
    ? plan.slice(0, 30)
    : plan.filter((item) => item.kind === 'topic').slice(0, 6);
  const candidates = new Map();
  const failures = [];
  let succeeded = 0;
  for (const query of selectedPlan) {
    try {
      const result = await fetchJson(
        GITHUB_API + '/search/repositories?q=' + encodeURIComponent(query.query) +
        '&sort=' + query.sort + '&order=desc&per_page=100',
      );
      succeeded += 1;
      for (const raw of result.items || []) {
        try {
          addCandidate(candidates, normalizeRepository(raw), query.categoryKey, query.kind);
        } catch (error) {
          failures.push({ name: 'search result', error: error.message });
        }
      }
    } catch (error) {
      failures.push({ name: query.categoryKey + ':' + query.kind, error: error.message });
    }
  }

  // Seed collections keep established projects visible while search catches
  // new projects. They do not bypass classification; they only add a weak
  // seed signal in classifyRepository().
  for (const [repoName, meta] of catalog.repoMeta.entries()) {
    const key = 'name:' + repoName;
    const existing = candidates.get(key) || [...candidates.values()].find((candidate) => candidate.repository.name === repoName);
    if (existing) {
      for (const categoryKey of meta.seedCategories) {
        if (!existing.candidateCategories.includes(categoryKey)) existing.candidateCategories.push(categoryKey);
      }
      continue;
    }
    addCandidate(candidates, {
      name: repoName,
      url: 'https://github.com/' + repoName,
      description: '',
      language: '',
      stars: 0,
      forks: 0,
      watchers: 0,
      openIssues: 0,
      createdAt: null,
      updatedAt: null,
      pushedAt: null,
      archived: false,
      license: '',
      topics: [],
      avatarUrl: 'https://github.com/' + repoName.split('/')[0] + '.png?size=80',
    }, meta.seedCategories[0], 'seed');
    const seedCandidate = candidates.get(key);
    if (seedCandidate) {
      seedCandidate.candidateCategories = [...new Set(meta.seedCategories)];
      seedCandidate.sourceNames = [repoName];
    }
  }
  return {
    candidates: [...candidates.values()],
    queries: selectedPlan.length,
    succeeded,
    failures,
  };
}

function selectCandidates(candidates, limit, categoryOrder) {
  if (candidates.length <= limit) return candidates;
  const buckets = categoryOrder.map((key) => candidates.filter((candidate) => candidate.candidateCategories.includes(key)));
  const selected = [];
  const seen = new Set();
  let cursor = 0;
  while (selected.length < limit && cursor < 1000) {
    let added = false;
    for (const bucket of buckets) {
      const candidate = bucket[cursor];
      if (candidate && !seen.has(candidate.repository.name)) {
        selected.push(candidate);
        seen.add(candidate.repository.name);
        added = true;
        if (selected.length >= limit) break;
      }
    }
    if (!added) break;
    cursor += 1;
  }
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (!seen.has(candidate.repository.name)) {
      selected.push(candidate);
      seen.add(candidate.repository.name);
    }
  }
  return selected;
}

function decodeReadme(raw) {
  if (!raw || typeof raw.content !== 'string') return '';
  try {
    return Buffer.from(raw.content.replace(/\s/g, ''), 'base64')
      .toString('utf8')
      .slice(0, MAX_README_CHARS);
  } catch (error) {
    return '';
  }
}

async function fetchAiRepositories(discovery, catalog) {
  const requestedLimit = Number(process.env.AI_CANDIDATE_LIMIT || DEFAULT_AI_CANDIDATE_LIMIT);
  const selected = selectCandidates(
    discovery.candidates,
    Math.max(1, requestedLimit),
    catalog.categories.map((category) => category.key),
  );
  const fetched = [];
  const failures = [];
  await mapLimit(selected, TOKEN ? 10 : 4, async (candidate) => {
    const requestedName = candidate.repository.name;
    try {
      const raw = await fetchJson(GITHUB_API + '/repos/' + requestedName);
      const repository = normalizeRepository(raw);
      if (repository.archived || repository.fork || repository.disabled) return;
      let readmeText = '';
      if (READMEs_ENABLED) {
        try {
          readmeText = decodeReadme(await fetchJson(GITHUB_API + '/repos/' + repository.name + '/readme'));
        } catch (error) {
          // README is an enrichment signal. Metadata and Topics are enough to
          // continue if a repository has no README or the request is denied.
        }
      }
      fetched.push({
        repository,
        sourceName: requestedName,
        candidateCategories: candidate.candidateCategories,
        discoverySources: candidate.discoverySources,
        readmeText,
      });
    } catch (error) {
      failures.push({ name: requestedName, error: error.message });
    }
  });
  return {
    requested: selected.length,
    available: discovery.candidates.length,
    fetched,
    failures,
    limited: selected.length < discovery.candidates.length,
  };
}

async function fetchGeneralRepositories() {
  const queries = [
    {
      key: 'active',
      q: 'stars:>=500 pushed:>=' + daysAgo(30) + ' archived:false',
      sort: 'updated',
    },
    {
      key: 'new',
      q: 'stars:>=100 created:>=' + daysAgo(120) + ' archived:false',
      sort: 'stars',
    },
    {
      key: 'early',
      q: 'stars:>=10 created:>=' + daysAgo(90) +
        ' pushed:>=' + daysAgo(30) + ' archived:false',
      sort: 'updated',
    },
  ];
  const fetched = [];
  const failures = [];
  let succeeded = 0;
  for (const query of queries) {
    try {
      const result = await fetchJson(
        GITHUB_API + '/search/repositories?q=' + encodeURIComponent(query.q) +
        '&sort=' + query.sort + '&order=desc&per_page=100',
      );
      succeeded += 1;
      for (const raw of result.items || []) {
        try {
          const repository = normalizeRepository(raw);
          if (!repository.archived && !repository.fork && !repository.disabled) fetched.push({ repository, sourceName: repository.name });
        } catch (error) {
          failures.push({ name: 'search result', error: error.message });
        }
      }
    } catch (error) {
      failures.push({ name: query.key, error: error.message });
    }
  }
  const unique = new Map();
  for (const item of fetched) unique.set(item.repository.name, item);
  return {
    requested: queries.length,
    succeeded,
    fetched: [...unique.values()],
    failures,
  };
}

function appendUnique(target, values) {
  for (const value of values || []) {
    if (!target.includes(value)) target.push(value);
  }
}

function addOrMerge(map, item, catalog, sourceName, isFresh) {
  const repository = item.repository;
  const key = repository.id ? 'id:' + repository.id : 'name:' + repository.name;
  const seeded = catalog.repoMeta.get(sourceName);
  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      ...repository,
      sourceNames: [sourceName],
      seedCategories: seeded ? [...seeded.seedCategories] : [],
      candidateCategories: Array.isArray(item.candidateCategories) ? [...item.candidateCategories] : [],
      discoverySources: Array.isArray(item.discoverySources) ? [...item.discoverySources] : [],
      categoryCandidates: [],
      readmeText: item.readmeText || '',
      isFresh,
    });
    return;
  }
  appendUnique(existing.sourceNames, [sourceName]);
  appendUnique(existing.seedCategories, seeded ? seeded.seedCategories : []);
  appendUnique(existing.candidateCategories, item.candidateCategories || []);
  appendUnique(existing.discoverySources, item.discoverySources || []);
  existing.isFresh = existing.isFresh || isFresh;
  if (item.readmeText && item.readmeText.length > existing.readmeText.length) {
    existing.readmeText = item.readmeText;
  }
  if (repository.stars >= existing.stars || existing.stale) {
    Object.assign(existing, repository);
  }
}

async function addExternalCandidates(repoMap, sourceResults) {
  const known = new Set([...repoMap.values()].map((repo) => repoKey(repo.name)));
  const candidates = [];
  const seen = new Set(known);
  for (const result of sourceResults) {
    for (const [key, signal] of result.signals.entries()) {
      const name = signal.raw && signal.raw.repoName ? signal.raw.repoName : key;
      const normalized = repoKey(name);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      candidates.push({
        name,
        discoverySource: result.source,
      });
      if (candidates.length >= (TOKEN ? 220 : 20)) break;
    }
    if (candidates.length >= (TOKEN ? 220 : 20)) break;
  }
  const failures = [];
  await mapLimit(candidates, TOKEN ? 10 : 4, async (candidate) => {
    try {
      const raw = await fetchJson(GITHUB_API + '/repos/' + candidate.name);
      const repository = normalizeRepository(raw);
      if (repository.archived || repository.fork || repository.disabled) return;
      let readmeText = '';
      if (READMEs_ENABLED) {
        try {
          readmeText = decodeReadme(await fetchJson(GITHUB_API + '/repos/' + repository.name + '/readme'));
        } catch (error) {}
      }
      addOrMerge(repoMap, {
        repository,
        sourceName: candidate.name,
        candidateCategories: [],
        discoverySources: ['external:' + candidate.discoverySource],
        readmeText,
      }, { repoMeta: new Map() }, candidate.name, true);
    } catch (error) {
      failures.push({ name: candidate.name, error: error.message });
    }
  });
  return {
    requested: candidates.length,
    fetched: candidates.length - failures.length,
    failures,
  };
}

function hasTerm(text, term) {
  const normalized = normalizeText(term);
  if (!normalized) return false;
  return (' ' + text + ' ').includes(' ' + normalized + ' ');
}

function classifyRepository(repo, categories, previousCategories, taxonomyVersion) {
  const fields = [
    { key: 'topics', text: normalizeText((repo.topics || []).join(' ')), factor: 3.2 },
    { key: 'name', text: normalizeText(repo.name), factor: 2.8 },
    { key: 'description', text: normalizeText(repo.description), factor: 2.1 },
    { key: 'readme', text: normalizeText(repo.readmeText).slice(0, MAX_README_CHARS), factor: 1 },
  ];
  const candidateKeys = new Set(repo.candidateCategories || []);
  const seedKeys = new Set((repo.seedCategories || []).concat(previousCategories || []));
  const results = [];
  const candidateResults = [];

  for (const category of categories) {
    let score = 0;
    const evidence = [];
    const evidenceTypes = new Set();
    let strongTopicHit = false;
    const topicText = fields[0].text;
    for (const topic of category.discoveryTopics || []) {
      if (hasTerm(topicText, topic)) {
        const isStrongTopic = (category.strongTopics || []).some((strongTopic) => normalizeText(strongTopic) === normalizeText(topic));
        score += isStrongTopic ? 7 : 1.2;
        strongTopicHit = strongTopicHit || isStrongTopic;
        evidence.push('topic:' + normalizeText(topic));
        evidenceTypes.add('topic');
      }
    }
    const signals = [];
    for (const alias of category.aliases || []) signals.push({ term: alias, weight: 3.2 });
    for (const signal of category.signals || []) {
      signals.push({
        term: typeof signal === 'string' ? signal : signal.term,
        weight: typeof signal === 'string' ? 2.2 : Number(signal.weight || 2.2),
      });
    }
    for (const signal of signals) {
      let bestField = null;
      for (const field of fields) {
        if (hasTerm(field.text, signal.term) && (!bestField || field.factor > bestField.factor)) {
          bestField = field;
        }
      }
      if (bestField) {
        score += signal.weight * bestField.factor;
        evidence.push(bestField.key + ':' + normalizeText(signal.term));
        evidenceTypes.add(bestField.key);
      }
    }
    if (candidateKeys.has(category.key)) {
      score += 1.4;
      evidence.push('discovery:' + category.key);
      evidenceTypes.add('discovery');
    }
    if (seedKeys.has(category.key)) {
      score += 1.2;
      evidence.push('seed:collection');
      evidenceTypes.add('seed');
    }
    for (const negative of category.negativeSignals || []) {
      if (fields.some((field) => hasTerm(field.text, negative))) {
        score -= 6;
        evidence.push('exclude:' + normalizeText(negative));
        evidenceTypes.add('exclude');
      }
    }
    const hasDirectEvidence = [...evidenceTypes].some((type) => ['topic', 'name', 'description', 'readme'].includes(type));
    const seedOnly = seedKeys.has(category.key) && !hasDirectEvidence && !evidenceTypes.has('exclude');
    if ((!hasDirectEvidence && !seedOnly) || (!strongTopicHit && score < category.threshold && !seedOnly)) continue;
    if (seedOnly) score = category.threshold;
    if (score < category.threshold) continue;
    const directEvidenceTypes = [...evidenceTypes].filter((type) => ['topic', 'name', 'description', 'readme'].includes(type));
    const strongTextEvidence = directEvidenceTypes.some((type) => ['name', 'description', 'readme'].includes(type));
    const confirmed = !seedOnly && (
      directEvidenceTypes.length >= 2 ||
      (strongTextEvidence && score >= category.threshold + 1) ||
      (strongTopicHit && score >= category.threshold + 3)
    );
    const confidence = Math.max(
      0.5,
      Math.min(
        0.99,
        0.5 +
          (score - category.threshold) / Math.max(category.threshold * 2, 1) +
          Math.min(0.12, Math.max(0, evidenceTypes.size - 1) * 0.04),
      ),
    );
    const classification = {
      key: category.key,
      label: category.label,
      labelZh: category.labelZh,
      color: category.color,
      confidence: Math.round(confidence * 100) / 100,
      score: Math.round(score * 100) / 100,
      method: seedOnly ? 'seed' : 'topics+metadata+readme',
      evidence: [...new Set(evidence)].slice(0, 6),
      taxonomyVersion,
      status: confirmed ? 'confirmed' : 'candidate',
    };
    if (confirmed) results.push(classification);
    else candidateResults.push(classification);
  }
  return {
    categories: results.sort((a, b) => b.score - a.score).slice(0, 4),
    candidates: candidateResults.sort((a, b) => b.score - a.score).slice(0, 4),
  };
}

function pointsFor(history, keys) {
  for (const key of keys) {
    const points = Array.isArray(history.snapshots && history.snapshots[key])
      ? history.snapshots[key]
      : [];
    if (points.length) {
      return points
        .filter((point) => point && point.date && Number.isFinite(Number(point.stars)))
        .map((point) => ({
          date: String(point.date),
          stars: Number(point.stars),
          forks: Number(point.forks || 0),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }
  }
  return [];
}

function daysBetween(left, right) {
  const a = new Date(left + 'T00:00:00Z').getTime();
  const b = new Date(right + 'T00:00:00Z').getTime();
  return (b - a) / 86400000;
}

function calculateGrowth(points, currentValue, days, field = 'stars') {
  const targetDate = new Date(new Date(SNAPSHOT_DATE + 'T00:00:00Z').getTime() - days * 86400000)
    .toISOString()
    .slice(0, 10);
  const baseline = [...points].reverse().find((point) => point.date <= targetDate);
  const current = [...points].reverse().find((point) => point.date <= SNAPSHOT_DATE);
  if (!baseline || !current) {
    return {
      delta: null,
      percent: null,
      weightedScore: null,
      baselineDate: null,
      baselineReady: false,
    };
  }
  const effectiveCurrentValue = Number.isFinite(currentValue) ? currentValue : current[field];
  const baselineValue = Number(baseline[field] || 0);
  const delta = effectiveCurrentValue - baselineValue;
  const relevant = points.filter((point) => point.date > baseline.date && point.date <= SNAPSHOT_DATE);
  let previous = baseline;
  let weightedScore = 0;
  for (const point of relevant) {
    const increment = Math.max(0, Number(point[field] || 0) - Number(previous[field] || 0));
    const age = Math.max(0, daysBetween(point.date, SNAPSHOT_DATE));
    const weight = 2 + 3 * Math.max(0, 1 - Math.min(age, days) / days);
    weightedScore += increment * weight;
    previous = point;
  }
  if (!relevant.length && delta > 0) weightedScore = delta * 2;
  return {
    delta,
    percent: baselineValue > 0 ? (delta / baselineValue) * 100 : null,
    weightedScore: Math.round(weightedScore * 10) / 10,
    baselineDate: baseline.date,
    baselineReady: true,
  };
}

function currentPopularityScore(repo, growth7d, growth28d, forkGrowth28d) {
  const rawPushAge = repo.pushedAt
    ? daysBetween(String(repo.pushedAt).slice(0, 10), SNAPSHOT_DATE)
    : 3650;
  const pushAge = Number.isFinite(rawPushAge) ? Math.max(0, rawPushAge) : 3650;
  const starsSignal = Math.min(70, Math.log10(Number(repo.stars || 0) + 1) * 14);
  const forkSignal = Math.min(20, Math.log10(Number(repo.forks || 0) + 1) * 4);
  const activitySignal = pushAge <= 7 ? 10 : pushAge <= 30 ? 7 : pushAge <= 90 ? 3 : 0;
  const starGrowthSignal = Math.min(
    13,
    Math.log10(Math.max(0, Number(growth28d && growth28d.delta || 0)) + 1) * 6 +
      Math.log10(Math.max(0, Number(growth7d && growth7d.delta || 0)) + 1) * 4,
  );
  const forkGrowthSignal = Math.min(7, Math.log10(Math.max(0, Number(forkGrowth28d && forkGrowth28d.delta || 0)) + 1) * 2.5);
  return Math.round(Math.min(100, starsSignal + forkSignal + activitySignal + starGrowthSignal + forkGrowthSignal) * 10) / 10;
}

function trimHistory(points) {
  const cutoff = new Date(new Date(SNAPSHOT_DATE + 'T00:00:00Z').getTime() - 120 * 86400000)
    .toISOString()
    .slice(0, 10);
  const byDate = new Map(points.map((point) => [point.date, point]));
  return [...byDate.values()]
    .filter((point) => point.date >= cutoff && point.date <= SNAPSHOT_DATE)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function enrichRepositories(repoMap, history) {
  const output = [];
  for (const raw of repoMap.values()) {
    const repo = { ...raw };
    const historyKeys = [repo.name].concat(repo.sourceNames || []);
    const previousPoints = pointsFor(history, historyKeys);
    const currentPoints = repo.isFresh
      ? trimHistory(previousPoints.concat({
        date: SNAPSHOT_DATE,
        stars: repo.stars,
        forks: repo.forks,
      }))
      : previousPoints;
    if (repo.isFresh) history.snapshots[repo.name] = currentPoints;
    const growth7d = calculateGrowth(currentPoints, repo.stars, 7);
    const growth28d = calculateGrowth(currentPoints, repo.stars, 28);
    const forkGrowth28d = calculateGrowth(currentPoints, repo.forks, 28, 'forks');
    const popularScore = currentPopularityScore(repo, growth7d, growth28d, forkGrowth28d);
    const githubSignal = Array.isArray(repo.sourceSignals)
      ? repo.sourceSignals.find((signal) => signal.source === 'github')
      : null;
    if (githubSignal) {
      githubSignal.score = popularScore;
      githubSignal.raw = {
        stars: Number(repo.stars || 0),
        forks: Number(repo.forks || 0),
        pushedAt: repo.pushedAt || null,
      };
    }
    const attentionScore = calculateAttention(repo);
    const sourceSignals = summarizeSources(repo);
    delete repo.seedCategories;
    delete repo.candidateCategories;
    delete repo.discoverySources;
    delete repo.categoryCandidates;
    delete repo.sourceNames;
    delete repo.isFresh;
    delete repo.readmeText;
    delete repo.stale;
    delete repo.sourceSignals;
    output.push({
      ...repo,
      isAi: repo.categories.length > 0,
      classificationCandidates: Array.isArray(raw.categoryCandidates) ? raw.categoryCandidates : [],
      popularScore,
      attentionScore,
      sourceSignals,
      sourceCount: sourceSignals.length,
      growth7d,
      growth28d,
      forkGrowth28d,
      dataFreshness: raw.isFresh ? 'fresh' : 'stale-fallback',
      snapshotCount: currentPoints.length,
    });
  }
  return output;
}

function buildCategoryStats(categories, repositories) {
  return categories.map((category) => {
    const categoryRepos = repositories.filter((repo) => repo.categories.some((item) => item.key === category.key));
    const sorted = categoryRepos.slice().sort((a, b) => {
      const scoreA = a.attentionScore == null ? (a.popularScore == null ? 0 : a.popularScore) : a.attentionScore;
      const scoreB = b.attentionScore == null ? (b.popularScore == null ? 0 : b.popularScore) : b.attentionScore;
      return scoreB - scoreA || b.stars - a.stars;
    });
    return {
      key: category.key,
      label: category.label,
      labelZh: category.labelZh,
      color: category.color,
      description: category.description,
      descriptionZh: category.descriptionZh,
      collectionIds: category.sources.map((source) => source.id),
      count: categoryRepos.length,
      topRepo: sorted[0] ? sorted[0].name : '',
    };
  });
}

async function main() {
  await mkdir(DATA_ROOT, { recursive: true });
  const catalog = await loadCatalog();
  const previousData = await readJson(OUTPUT_PATH, { repos: [] });
  const previousRepos = Array.isArray(previousData.repos) ? previousData.repos : [];
  const previousByName = new Map(previousRepos.map((repo) => [repo.name, repo]));
  const history = await readJson(SNAPSHOTS_PATH, { version: 1, snapshots: {} });
  if (!history.snapshots || typeof history.snapshots !== 'object') history.snapshots = {};

  const discovery = await discoverAiCandidates(catalog);
  const ai = await fetchAiRepositories(discovery, catalog);
  const general = await fetchGeneralRepositories();
  const repoMap = new Map();
  for (const item of ai.fetched) {
    addOrMerge(repoMap, item, catalog, item.sourceName, true);
  }
  for (const item of general.fetched) {
    addOrMerge(repoMap, item, catalog, item.sourceName, true);
  }

  for (const failure of ai.failures) {
    const previous = previousByName.get(failure.name);
    if (previous && previous.isAi) {
      const key = previous.id ? 'id:' + previous.id : 'name:' + previous.name;
      if (!repoMap.has(key)) {
        repoMap.set(key, {
          ...previous,
          stale: true,
          isFresh: false,
          sourceNames: [failure.name],
          seedCategories: [],
          candidateCategories: [],
          discoverySources: [],
          categoryCandidates: Array.isArray(previous.categoryCandidates) ? previous.categoryCandidates : [],
          readmeText: '',
          categories: Array.isArray(previous.categories) ? previous.categories : [],
        });
      }
    }
  }
  if (ai.succeeded === 0 && ai.failures.length > 0) {
    for (const previous of previousRepos.filter((repo) => repo.isAi)) {
      const key = previous.id ? 'id:' + previous.id : 'name:' + previous.name;
      if (!repoMap.has(key)) {
        repoMap.set(key, {
          ...previous,
          stale: true,
          isFresh: false,
          sourceNames: [previous.name],
          seedCategories: [],
          candidateCategories: [],
          discoverySources: [],
          categoryCandidates: Array.isArray(previous.categoryCandidates) ? previous.categoryCandidates : [],
          readmeText: '',
          categories: Array.isArray(previous.categories) ? previous.categories : [],
        });
      }
    }
  }
  if (general.succeeded === 0) {
    for (const previous of previousRepos.filter((repo) => !repo.isAi)) {
      const key = previous.id ? 'id:' + previous.id : 'name:' + previous.name;
      if (!repoMap.has(key)) {
        repoMap.set(key, {
          ...previous,
          stale: true,
          isFresh: false,
          sourceNames: [previous.name],
          seedCategories: [],
          candidateCategories: [],
          discoverySources: [],
          categoryCandidates: Array.isArray(previous.categoryCandidates) ? previous.categoryCandidates : [],
          readmeText: '',
          categories: Array.isArray(previous.categories) ? previous.categories : [],
        });
      }
    }
  }

  const discoverySourceSettled = await Promise.allSettled([
    fetchHackerNewsSignals(),
    fetchHelloGitHubSignals(),
    fetchHuggingFaceSignals(),
  ]);
  const discoverySourceResults = discoverySourceSettled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  const externalCandidates = await addExternalCandidates(repoMap, discoverySourceResults);
  const usageSourceSettled = await Promise.allSettled([
    fetchNpmSignals([...repoMap.values()]),
    fetchPypiSignals([...repoMap.values()]),
    fetchDockerSignals([...repoMap.values()]),
  ]);
  const usageSourceResults = usageSourceSettled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  const sourceResults = discoverySourceResults.concat(usageSourceResults);
  for (const raw of repoMap.values()) {
    raw.popularScore = currentPopularityScore(raw);
  }
  attachExternalSignals(repoMap, sourceResults);

  for (const raw of repoMap.values()) {
    const classification = classifyRepository(
      raw,
      catalog.categories,
      raw.categories ? raw.categories.map((category) => category.key) : [],
      catalog.taxonomyVersion,
    );
    raw.categories = classification.categories;
    raw.categoryCandidates = classification.candidates;
  }

  const repositories = enrichRepositories(repoMap, history)
    .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
  const categories = buildCategoryStats(catalog.categories, repositories);
  const aiRepositories = repositories.filter((repo) => repo.isAi);
  const baselineReady = repositories.some((repo) => repo.growth7d && repo.growth7d.baselineReady);
  const warningList = catalog.warnings.slice();
  if (!TOKEN) {
    warningList.push('No GitHub token: local mode limits AI discovery and skips README enrichment.');
  }
  if (ai.failures.length || general.failures.length || discovery.failures.length) {
    warningList.push('Some GitHub requests failed; stale records are retained only when a previous record exists.');
  }
  if (!aiRepositories.length) {
    warningList.push('No repositories crossed the taxonomy threshold; inspect taxonomy evidence or lower a category threshold.');
  }

  const output = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    asOfDate: SNAPSHOT_DATE,
    sourceRepository: SOURCE_REPOSITORY,
    taxonomyVersion: catalog.taxonomyVersion,
    dataQuality: {
      strategy: 'multi_source_attention',
      eventFeedUsed: false,
      currentTotals: 'GitHub REST repository metadata (stargazers_count)',
      historyFile: 'data/snapshots.json',
      snapshotCadence: 'daily',
      classification: 'deterministic topics+metadata+readme evidence with confidence',
      attentionSources: sourceResults.map((result) => result.source),
      note: 'Candidate discovery and classification are dynamic; collection files are seed examples only. No model call or human review is required.',
    },
    categories,
    repos: repositories,
    stats: {
      totalRepos: repositories.length,
      aiRepos: aiRepositories.length,
      totalCategories: categories.length,
      totalStars: repositories.reduce((sum, repo) => sum + Number(repo.stars || 0), 0),
      baselineReady,
      baselineWindow: repositories.some((repo) => repo.growth28d && repo.growth28d.baselineReady) ? '28d' : baselineReady ? '7d' : null,
      snapshotDate: SNAPSHOT_DATE,
    },
    discovery: {
      aiQueries: discovery.queries,
      aiSearchesSucceeded: discovery.succeeded,
      aiCandidates: discovery.candidates.length,
      aiCandidatesFetched: ai.fetched.length,
      aiCandidateLimit: ai.requested,
      readmesUsed: READMEs_ENABLED,
      externalCandidatesFetched: externalCandidates.fetched,
      externalCandidatesRequested: externalCandidates.requested,
    },
    sources: sourceResults.map((result) => ({
      source: result.source,
      stats: result.stats,
      failures: Array.isArray(result.failures) ? result.failures.length : 0,
    })),
    fetch: {
      ai: {
        requested: ai.requested,
        available: ai.available,
        succeeded: ai.fetched.length,
        failed: ai.failures.length,
        limited: ai.limited,
        mode: TOKEN ? 'github-token' : 'public-api',
      },
      general: {
        requested: general.requested,
        succeeded: general.succeeded,
        returned: general.fetched.length,
        failed: general.failures.length,
      },
    },
    warnings: warningList,
  };

  await writeFile(SNAPSHOTS_PATH, JSON.stringify({
    version: 1,
    updatedAt: new Date().toISOString(),
    snapshots: history.snapshots,
  }, null, 2) + '\n');
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');

  console.log('AI Repo Pulse data refreshed.');
  console.log('  AI candidates discovered: ' + discovery.candidates.length);
  console.log('  AI repositories classified: ' + aiRepositories.length);
  console.log('  General repositories: ' + general.fetched.length);
  console.log('  Snapshot date: ' + SNAPSHOT_DATE);
  console.log('  baseline ready: ' + (baselineReady ? 'yes' : 'not yet'));
  if (warningList.length) {
    console.log('  Warnings: ' + warningList.length);
    for (const warning of warningList) console.log('    - ' + warning);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
