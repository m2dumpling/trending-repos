import { fetchJson, mapLimit, repoFromUrl, repoKey, sourceRecord, clamp } from './common.mjs';

const API_ROOT = 'https://hacker-news.firebaseio.com/v0';
const FEEDS = [
  { name: 'topstories', limit: 180 },
  { name: 'newstories', limit: 180 },
  { name: 'beststories', limit: 180 },
  { name: 'showstories', limit: 120 },
];

function scoreStory(points, comments, feedCount, storyTime) {
  const ageHours = storyTime
    ? Math.max(0, Date.now() / 1000 - Number(storyTime)) / 3600
    : 720;
  const recency = Math.max(0, 12 - ageHours / 18);
  return clamp(
    Math.log1p(points) * 14 +
      Math.log1p(comments) * 8 +
      feedCount * 5 +
      recency,
    0,
    100,
  );
}

export async function fetchHackerNewsSignals() {
  const idsByFeed = new Map();
  const failures = [];
  let feedSuccesses = 0;

  for (const feed of FEEDS) {
    try {
      const ids = await fetchJson(API_ROOT + '/' + feed.name + '.json');
      feedSuccesses += 1;
      for (const id of (ids || []).slice(0, feed.limit)) {
        const key = String(id);
        const feeds = idsByFeed.get(key) || [];
        if (!feeds.includes(feed.name)) feeds.push(feed.name);
        idsByFeed.set(key, feeds);
      }
    } catch (error) {
      failures.push({ feed: feed.name, error: error.message });
    }
  }

  const items = [];
  await mapLimit([...idsByFeed.entries()], 20, async ([id, feeds]) => {
    try {
      const item = await fetchJson(API_ROOT + '/item/' + id + '.json');
      if (item && item.type === 'story' && item.url) items.push({ item, feeds });
    } catch (error) {
      failures.push({ item: id, error: error.message });
    }
  });

  const byRepo = new Map();
  for (const entry of items) {
    const repoName = repoFromUrl(entry.item.url);
    if (!repoName) continue;
    const key = repoKey(repoName);
    const existing = byRepo.get(key) || {
      repoName,
      stories: new Map(),
      feeds: new Set(),
      points: 0,
      comments: 0,
      latestTime: 0,
    };
    const storyId = String(entry.item.id);
    existing.stories.set(storyId, {
      id: entry.item.id,
      title: entry.item.title || repoName,
      url: entry.item.url,
      points: Number(entry.item.score || 0),
      comments: Number(entry.item.descendants || 0),
      time: Number(entry.item.time || 0),
    });
    for (const feed of entry.feeds) existing.feeds.add(feed);
    existing.points += Number(entry.item.score || 0);
    existing.comments += Number(entry.item.descendants || 0);
    existing.latestTime = Math.max(existing.latestTime, Number(entry.item.time || 0));
    byRepo.set(key, existing);
  }

  const signals = new Map();
  for (const [key, value] of byRepo.entries()) {
    const stories = [...value.stories.values()].sort((a, b) => b.time - a.time);
    const latestAt = value.latestTime ? new Date(value.latestTime * 1000).toISOString() : null;
    const score = scoreStory(value.points, value.comments, value.feeds.size, value.latestTime);
    signals.set(key, sourceRecord(
      'hacker-news',
      score,
      {
        repoName: value.repoName,
        mentions: stories.length,
        points: value.points,
        comments: value.comments,
        feeds: [...value.feeds],
        stories: stories.slice(0, 3),
      },
      stories[0] ? stories[0].url : null,
      latestAt,
    ));
  }

  return {
    source: 'hacker-news',
    signals,
    stats: {
      feeds: FEEDS.length,
      feedsSucceeded: feedSuccesses,
      storiesFetched: items.length,
      repositoriesMentioned: signals.size,
      failures: failures.length,
    },
    failures,
  };
}
