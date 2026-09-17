import { fetchJson, fetchText, mapLimit, repoKey, sourceRecord, clamp } from './common.mjs';

const RAW_ROOT = 'https://raw.githubusercontent.com/';
const STATS_ROOT = 'https://pypistats.org/api/packages/';
const LIMIT = Number(process.env.PYPI_LIMIT || (process.env.GITHUB_TOKEN || process.env.GH_TOKEN ? 100 : 60));
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

function headers() {
  return {
    Accept: 'application/json',
    'User-Agent': 'repo-radar/1.0 (+public-project)',
    ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}),
  };
}

function projectName(pyproject) {
  const matches = [
    pyproject.match(/^\s*name\s*=\s*["']([^"']+)["']/m),
    pyproject.match(/^\s*project\s*=\s*\{[\s\S]*?name\s*=\s*["']([^"']+)["']/m),
  ].filter(Boolean);
  return matches[0] ? matches[0][1].trim() : '';
}

export async function fetchPypiSignals(repositories) {
  const failures = [];
  let rateLimited = 0;
  const candidates = repositories
    .filter((repo) => ['Python', 'Jupyter Notebook'].includes(repo.language))
    .slice(0, LIMIT);
  const signals = new Map();

  await mapLimit(candidates, 2, async (repo) => {
    const branch = repo.defaultBranch || 'main';
    const projectUrl = RAW_ROOT + repo.name + '/' + encodeURIComponent(branch) + '/pyproject.toml';
    let pyproject;
    try {
      pyproject = await fetchText(projectUrl, { headers: headers() });
    } catch (error) {
      if (String(error.message).startsWith('HTTP 404')) return;
      if (String(error.message).startsWith('HTTP 429')) {
        rateLimited += 1;
        return;
      }
      failures.push({ repo: repo.name, error: error.message });
      return;
    }
    try {
      const packageName = projectName(pyproject);
      if (!packageName) return;
      const stats = await fetchJson(STATS_ROOT + encodeURIComponent(packageName) + '/recent');
      const downloads = stats && stats.data ? Number(stats.data.last_week || 0) : 0;
      if (!downloads) return;
      signals.set(repoKey(repo.name), sourceRecord(
        'pypi',
        clamp(Math.log1p(downloads) * 11, 0, 100),
        {
          repoName: repo.name,
          package: packageName,
          downloadsLastWeek: downloads,
        },
        'https://pypi.org/project/' + encodeURIComponent(packageName) + '/',
        new Date().toISOString(),
      ));
    } catch (error) {
      if (String(error.message).startsWith('HTTP 404')) return;
      if (String(error.message).startsWith('HTTP 429')) {
        rateLimited += 1;
        return;
      }
      failures.push({ repo: repo.name, error: error.message });
    }
  });

  return {
    source: 'pypi',
    signals,
    stats: {
      repositoriesChecked: candidates.length,
      repositoriesMentioned: signals.size,
      failures: failures.length,
      rateLimited,
    },
    failures,
  };
}
