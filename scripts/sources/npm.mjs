import { fetchJson, fetchText, mapLimit, repoFromUrl, repoKey, sourceRecord, clamp } from './common.mjs';

const RAW_ROOT = 'https://raw.githubusercontent.com/';
const DOWNLOADS_ROOT = 'https://api.npmjs.org/downloads/point/last-week/';
const LIMIT = Number(process.env.NPM_LIMIT || 160);
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

function headers() {
  return {
    Accept: 'application/json',
    'User-Agent': 'repo-radar/1.0 (+public-project)',
    ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}),
  };
}

function repositoryMatchesPackage(packageJson, repoName) {
  const repository = packageJson.repository;
  const values = [];
  if (typeof repository === 'string') values.push(repository);
  if (repository && typeof repository === 'object') values.push(repository.url, repository.directory);
  values.push(packageJson.homepage);
  return values.some((value) => {
    if (!value) return false;
    const direct = repoFromUrl(value);
    if (direct && repoKey(direct) === repoKey(repoName)) return true;
    const shorthand = String(value).match(/github\s*[:/]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i);
    return shorthand && repoKey(shorthand[1]) === repoKey(repoName);
  });
}

export async function fetchNpmSignals(repositories) {
  const failures = [];
  const candidates = repositories
    .filter((repo) => ['JavaScript', 'TypeScript'].includes(repo.language))
    .slice(0, LIMIT);
  const signals = new Map();

  await mapLimit(candidates, 8, async (repo) => {
    const branch = repo.defaultBranch || 'main';
    const packageUrl = RAW_ROOT + repo.name + '/' + encodeURIComponent(branch) + '/package.json';
    let packageJson;
    try {
      packageJson = JSON.parse(await fetchText(packageUrl, { headers: headers() }));
    } catch (error) {
      if (String(error.message).startsWith('HTTP 404')) return;
      failures.push({ repo: repo.name, error: error.message });
      return;
    }
    try {
      if (!packageJson.name || packageJson.private || !repositoryMatchesPackage(packageJson, repo.name)) return;
      const downloadUrl = DOWNLOADS_ROOT + encodeURIComponent(packageJson.name);
      const downloads = await fetchJson(downloadUrl);
      const count = Number(downloads.downloads || 0);
      if (!count) return;
      signals.set(repoKey(repo.name), sourceRecord(
        'npm',
        clamp(Math.log1p(count) * 11, 0, 100),
        {
          repoName: repo.name,
          package: packageJson.name,
          downloadsLastWeek: count,
        },
        'https://www.npmjs.com/package/' + encodeURIComponent(packageJson.name),
        new Date().toISOString(),
      ));
    } catch (error) {
      if (String(error.message).startsWith('HTTP 404')) return;
      failures.push({ repo: repo.name, error: error.message });
    }
  });

  return {
    source: 'npm',
    signals,
    stats: {
      repositoriesChecked: candidates.length,
      repositoriesMentioned: signals.size,
      failures: failures.length,
    },
    failures,
  };
}
