import { fetchText, repoFromUrl, repoKey, sourceRecord, clamp } from './common.mjs';

const RSS_URL = 'https://hellogithub.com/rss';
const MAX_ISSUES = 3;

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function tag(block, name) {
  const match = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i'));
  return match ? decodeXml(match[1]).trim() : '';
}

function extractGithubLinks(html) {
  const matches = String(html || '').match(/https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:[^"'<>\\s)]*)?/gi) || [];
  return [...new Set(matches)]
    .map((link) => ({ link, repoName: repoFromUrl(link) }))
    .filter((item) => item.repoName);
}

function issueScore(latestAt, issueCount) {
  const days = latestAt ? Math.max(0, (Date.now() - new Date(latestAt).getTime()) / 86400000) : 365;
  return clamp(82 - days * 0.45 + Math.min(18, Math.max(0, issueCount - 1) * 5), 0, 100);
}

export async function fetchHelloGitHubSignals() {
  const failures = [];
  let issueBlocks = [];
  try {
    const rss = await fetchText(RSS_URL, {
      headers: { 'User-Agent': 'repo-radar/1.0 (+public-project)' },
    });
    issueBlocks = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
      .map((match) => match[1])
      .slice(0, MAX_ISSUES);
  } catch (error) {
    failures.push({ resource: RSS_URL, error: error.message });
  }

  const byRepo = new Map();
  for (const block of issueBlocks) {
    const issueUrl = tag(block, 'link');
    const issueTitle = tag(block, 'title');
    const publishedAt = tag(block, 'pubDate');
    try {
      const html = await fetchText(issueUrl, {
        headers: { 'User-Agent': 'repo-radar/1.0 (+public-project)' },
      });
      for (const link of extractGithubLinks(html)) {
        const key = repoKey(link.repoName);
        const existing = byRepo.get(key) || {
          repoName: link.repoName,
          issues: new Map(),
          latestAt: null,
          links: new Set(),
        };
        existing.issues.set(issueUrl, {
          title: issueTitle,
          url: issueUrl,
          publishedAt,
        });
        existing.links.add(link.link);
        if (!existing.latestAt || new Date(publishedAt).getTime() > new Date(existing.latestAt).getTime()) {
          existing.latestAt = publishedAt;
        }
        byRepo.set(key, existing);
      }
    } catch (error) {
      failures.push({ resource: issueUrl, error: error.message });
    }
  }

  const signals = new Map();
  for (const [key, value] of byRepo.entries()) {
    const issues = [...value.issues.values()].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    signals.set(key, sourceRecord(
      'hellogithub',
      issueScore(value.latestAt, issues.length),
      {
        repoName: value.repoName,
        featuredIssues: issues.length,
        issues: issues.slice(0, 3),
        githubLinks: [...value.links].slice(0, 3),
      },
      issues[0] ? issues[0].url : RSS_URL,
      value.latestAt,
    ));
  }

  return {
    source: 'hellogithub',
    signals,
    stats: {
      issuesRead: issueBlocks.length,
      repositoriesMentioned: signals.size,
      failures: failures.length,
    },
    failures,
  };
}
