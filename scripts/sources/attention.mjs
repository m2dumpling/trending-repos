import { clamp, repoKey } from './common.mjs';

const SOURCE_WEIGHTS = {
  github: 0.58,
  'hacker-news': 0.15,
  hellogithub: 0.1,
  huggingface: 0.09,
  npm: 0.04,
  pypi: 0.03,
  docker: 0.01,
};

function sourceLabel(source) {
  return {
    github: 'GitHub',
    'hacker-news': 'Hacker News',
    hellogithub: 'HelloGitHub',
    huggingface: 'Hugging Face',
    npm: 'npm',
    pypi: 'PyPI',
    docker: 'Docker Hub',
  }[source] || source;
}

export function attachExternalSignals(repoMap, sourceResults) {
  for (const repo of repoMap.values()) {
    repo.sourceSignals = repo.sourceSignals || [];
    const github = {
      source: 'github',
      score: clamp(repo.popularScore || 0, 0, 100),
      raw: {
        stars: Number(repo.stars || 0),
        forks: Number(repo.forks || 0),
        pushedAt: repo.pushedAt || null,
      },
      url: repo.url,
      observedAt: new Date().toISOString(),
    };
    repo.sourceSignals = [github];
    for (const result of sourceResults) {
      if (!result || !result.signals) continue;
      const signal = result.signals.get(repoKey(repo.name));
      if (signal) repo.sourceSignals.push(signal);
    }
  }
}

export function calculateAttention(repo) {
  const signals = Array.isArray(repo.sourceSignals) ? repo.sourceSignals : [];
  const weighted = signals.reduce((sum, signal) => {
    return sum + Number(signal.score || 0) * (SOURCE_WEIGHTS[signal.source] || 0);
  }, 0);
  const weightTotal = signals.reduce((sum, signal) => sum + (SOURCE_WEIGHTS[signal.source] || 0), 0);
  const base = weightTotal > 0 ? weighted / weightTotal : Number(repo.popularScore || 0);
  const sourceBonus = Math.min(8, Math.max(0, signals.length - 1) * 2);
  return Math.round(clamp(base + sourceBonus, 0, 100) * 10) / 10;
}

export function summarizeSources(repo) {
  const signals = Array.isArray(repo.sourceSignals) ? repo.sourceSignals : [];
  return signals.map((signal) => ({
    source: signal.source,
    label: sourceLabel(signal.source),
    score: signal.score,
    raw: signal.raw || {},
    url: signal.url || null,
    observedAt: signal.observedAt || null,
  }));
}

export function sourceLabels(repo) {
  return summarizeSources(repo).map((signal) => signal.label);
}
