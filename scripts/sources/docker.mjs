import { fetchJson, mapLimit, repoKey, sourceRecord, clamp } from './common.mjs';

const API_ROOT = 'https://hub.docker.com/v2/repositories/';
const LIMIT = Number(process.env.DOCKER_LIMIT || 160);

function dockerImages(repo) {
  const text = [repo.homepage, repo.description, ...(repo.topics || [])].filter(Boolean).join(' ');
  const references = [];
  const urlMatches = text.match(/hub\.docker\.com\/r\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/gi) || [];
  for (const value of urlMatches) references.push(value.split('/r/')[1]);
  const pullMatches = text.match(/docker\s+pull\s+([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/gi) || [];
  for (const value of pullMatches) references.push(value.replace(/^docker\s+pull\s+/i, ''));
  return [...new Set(references)];
}

export async function fetchDockerSignals(repositories) {
  const failures = [];
  const candidates = repositories
    .flatMap((repo) => dockerImages(repo).map((image) => ({ repo, image })))
    .slice(0, LIMIT);
  const signals = new Map();

  await mapLimit(candidates, 8, async ({ repo, image }) => {
    try {
      const info = await fetchJson(API_ROOT + image, {
        headers: { 'User-Agent': 'repo-radar/1.0 (+public-project)' },
      });
      const pulls = Number(info.pull_count || 0);
      if (!pulls) return;
      signals.set(repoKey(repo.name), sourceRecord(
        'docker',
        clamp(Math.log1p(pulls) * 8, 0, 100),
        {
          repoName: repo.name,
          image,
          pulls,
          stars: Number(info.star_count || 0),
          lastUpdated: info.last_updated || null,
        },
        'https://hub.docker.com/r/' + image,
        info.last_updated || new Date().toISOString(),
      ));
    } catch (error) {
      failures.push({ repo: repo.name, image, error: error.message });
    }
  });

  return {
    source: 'docker',
    signals,
    stats: {
      imagesChecked: candidates.length,
      repositoriesMentioned: signals.size,
      failures: failures.length,
    },
    failures,
  };
}
