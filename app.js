(function () {
  'use strict';

  var state = {
    board: 'general',
    category: 'All',
    sort: 'popular',
    query: '',
    language: getSavedLanguage(),
    data: null,
  };

  var copy = {
    en: {
      pageTitle: 'Repo Radar — GitHub projects people are watching',
      pageDescription: 'A live view of GitHub repositories people are watching now.',
      brandSubtitle: 'GitHub trend tracker',
      footerSubtitle: 'A simple view of GitHub attention',
      navTrending: 'Trending Repos',
      navAi: 'Trending AI Repos',
      heroGeneralKicker: 'Trending GitHub repositories',
      heroGeneralTitle: 'Projects people<br /><span>are watching.</span>',
      heroGeneralCopy: 'See the open-source projects people are paying attention to right now.',
      heroAiKicker: 'Trending AI repositories',
      heroAiTitle: 'AI projects<br /><span>people are watching.</span>',
      heroAiCopy: 'See the AI projects people are paying attention to right now, organized by technical direction.',
      heroCta: 'See the list',
      loadingLatest: 'Loading latest data',
      discovering: 'Discovering projects',
      updatedPrefix: 'Updated',
      trackedProjects: 'Tracked projects',
      discoveredFromGitHub: 'Discovered from GitHub',
      activeOpenSource: 'Active open-source projects',
      combinedStars: 'Combined stars',
      currentTotals: 'Current repository totals',
      aiCategories: 'AI categories',
      categoryHint: 'Multiple labels per project',
      dataUpdated: 'Data updated',
      buildingHistory: 'Building history',
      sevenDayReady: '7d history ready',
      twentyEightDayReady: '28d history ready',
      board: 'The board',
      trendingReposTitle: 'Trending Repos',
      trendingAiTitle: 'Trending AI Repos',
      generalDescription: 'Projects people are watching now, ranked by current community size and recent activity.',
      aiDescription: 'Projects people are watching now, ranked by current community size and recent activity.',
      loading: 'Loading',
      dataReady: 'Data ready',
      buildingHistoryStatus: 'Building history',
      dataUnavailable: 'Data unavailable',
      all: 'All',
      searchPlaceholder: 'Search projects',
      sortPopular: 'People are watching',
      sortStars: 'Total stars',
      sortRecent: 'Recently updated',
      popularNow: 'Popular now',
      popularTitle: 'People are watching',
      popularDescription: 'Current community size, forks and recent activity.',
      currentAttention: 'Sorted by current attention',
      starsSort: 'Sorted by total stars',
      recentSort: 'Sorted by recent activity',
      historySort: 'History is still building; showing current attention',
      recentMovers: 'Recent movers',
      noPopularYet: 'No projects are available right now.',
      peopleWatching: 'watching',
      stars: 'stars',
      currentScale: 'current scale',
      project: 'Project',
      sevenDay: '7d',
      twentyEightDay: '28d',
      heat: 'Attention',
      category: 'Category',
      openProject: 'Open project',
      noMatches: 'No projects found',
      noMatchesSearch: 'Try another search term.',
      noMatchesCategory: 'This direction has no matching projects right now.',
      aiDirections: 'AI directions',
      browseDirection: 'Browse by direction',
      browseDirectionCopy: 'A project may belong to more than one direction.',
      projectsCount: 'projects',
      topLabel: 'Leading',
      noCategoryProjects: 'No projects in this direction yet.',
      footerCopy: 'Updated by GitHub Actions · public GitHub data',
      languageLabel: 'Switch to Chinese',
      languageShort: '中文',
      openSource: 'Open source',
      evidenceLabel: 'evidence',
      confidenceLabel: 'confidence',
      sourceCountLabel: 'sources',
    },
    zh: {
      pageTitle: 'Repo Radar｜GitHub 项目热度榜',
      pageDescription: '持续查看 GitHub 上正在被关注的开源项目和 AI 项目。',
      brandSubtitle: 'GitHub 项目热度榜',
      footerSubtitle: '只看项目热度',
      navTrending: '热门项目',
      navAi: '热门 AI 项目',
      heroGeneralKicker: 'GitHub 项目热度榜',
      heroGeneralTitle: '大家都在关注<br><span>哪些项目？</span>',
      heroGeneralCopy: '看看现在受到关注的开源项目。',
      heroAiKicker: 'AI 项目热度榜',
      heroAiTitle: '大家都在关注<br><span>哪些 AI 项目？</span>',
      heroAiCopy: '看看现在最受关注的 AI 项目，并按技术方向浏览。',
      heroCta: '查看榜单',
      loadingLatest: '正在读取最新数据',
      discovering: '正在寻找新项目',
      updatedPrefix: '更新于',
      trackedProjects: '收录项目',
      discoveredFromGitHub: '来自 GitHub 自动发现',
      activeOpenSource: '近期活跃的开源项目',
      combinedStars: 'Star 总数',
      currentTotals: '项目当前总量',
      aiCategories: 'AI 分类',
      categoryHint: '一个项目可以有多个分类',
      dataUpdated: '数据更新时间',
      buildingHistory: '正在积累历史记录',
      sevenDayReady: '已有 7 天记录',
      twentyEightDayReady: '已有 28 天记录',
      board: '项目榜单',
      trendingReposTitle: '热门项目',
      trendingAiTitle: '热门 AI 项目',
      generalDescription: '按当前关注度整理 GitHub 项目，优先展示 Star、Fork 较多且近期有更新的项目。',
      aiDescription: '按当前关注度整理 AI 项目，优先展示 Star、Fork 较多且近期有更新的项目。',
      loading: '正在加载',
      dataReady: '数据已就绪',
      buildingHistoryStatus: '正在积累历史记录',
      dataUnavailable: '暂时无法读取数据',
      all: '全部',
      searchPlaceholder: '搜索项目',
      sortPopular: '大家都在关注',
      sortStars: 'Star 总数',
      sortRecent: '最近有更新',
      popularNow: '当前热门',
      popularTitle: '大家都在关注',
      popularDescription: '参考当前 Star、Fork 数量和最近的项目更新。',
      currentAttention: '按当前关注度排序',
      starsSort: '按 Star 总数排序',
      recentSort: '按最近更新时间排序',
      historySort: '历史记录仍在积累，暂按当前关注度展示',
      recentMovers: '最近增长较快',
      noPopularYet: '暂时没有可展示的项目。',
      peopleWatching: '关注',
      stars: 'Star',
      currentScale: '当前规模',
      project: '项目',
      sevenDay: '7 天',
      twentyEightDay: '28 天',
      heat: '关注度',
      category: '分类',
      openProject: '打开项目',
      noMatches: '没有找到项目',
      noMatchesSearch: '换个关键词试试。',
      noMatchesCategory: '这个方向暂时没有符合条件的项目。',
      aiDirections: 'AI 技术方向',
      browseDirection: '按方向浏览',
      browseDirectionCopy: '一个项目可以同时属于多个技术方向。',
      projectsCount: '个项目',
      topLabel: '代表项目',
      noCategoryProjects: '这个方向暂时还没有项目。',
      footerCopy: '由 GitHub Actions 定期更新 · 数据来自公开 GitHub 信息',
      languageLabel: '切换到英文',
      languageShort: 'EN',
      openSource: '开源项目',
      evidenceLabel: '分类依据',
      confidenceLabel: '匹配度',
      sourceCountLabel: '个来源',
    },
  };

  function getSavedLanguage() {
    try {
      return localStorage.getItem('repo-radar-language') === 'en' ? 'en' : 'zh';
    } catch (error) {
      return 'en';
    }
  }

  function t(key) {
    return copy[state.language][key] || copy.en[key] || key;
  }

  function qs(selector) {
    return document.querySelector(selector);
  }

  function setText(selector, value) {
    var element = qs(selector);
    if (element) element.textContent = value;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(state.language === 'zh' ? 'zh-CN' : 'en-US').format(Number(value || 0));
  }

  function formatCompact(value) {
    return new Intl.NumberFormat(state.language === 'zh' ? 'zh-CN' : 'en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return '—';
    var date = new Date(String(value).length === 10 ? value + 'T00:00:00Z' : value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(state.language === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  function ownerName(repo) {
    return String(repo.name || '').split('/')[0] || 'GitHub';
  }

  function repoNameOnly(repo) {
    var parts = String(repo.name || '').split('/');
    return parts[parts.length - 1] || repo.name;
  }

  function categoriesFor(repo) {
    return Array.isArray(repo.categories) ? repo.categories : [];
  }

  function boardRepos() {
    if (!state.data || !Array.isArray(state.data.repos)) return [];
    return state.board === 'ai'
      ? state.data.repos.filter(function (repo) { return repo.isAi; })
      : state.data.repos;
  }

  function sortValue(repo, sort) {
    if (sort === 'stars') return Number(repo.stars || 0);
    if (sort === 'recent') return new Date(repo.pushedAt || 0).getTime();
    return Number(repo.attentionScore == null ? repo.popularScore || 0 : repo.attentionScore);
  }

  function sortRepos(repos, sort) {
    return repos.slice().sort(function (left, right) {
      var difference = sortValue(right, sort) - sortValue(left, sort);
      if (difference !== 0 && !Number.isNaN(difference)) return difference;
      return Number(right.stars || 0) - Number(left.stars || 0);
    });
  }

  function applyCopy() {
    document.documentElement.lang = state.language === 'zh' ? 'zh-CN' : 'en';
    document.title = t('pageTitle');
    var meta = qs('meta[name="description"]');
    if (meta) meta.setAttribute('content', t('pageDescription'));
    document.querySelectorAll('[data-i18n]').forEach(function (element) {
      element.textContent = t(element.getAttribute('data-i18n'));
    });
    setText('#hero-kicker', state.board === 'ai' ? t('heroAiKicker') : t('heroGeneralKicker'));
    qs('#hero-title').innerHTML = state.board === 'ai' ? t('heroAiTitle') : t('heroGeneralTitle');
    setText('#hero-copy', state.board === 'ai' ? t('heroAiCopy') : t('heroGeneralCopy'));
    setText('#hero-cta', t('heroCta'));
    setText('#rankings-kicker', t('board'));
    setText('#rankings-title', state.board === 'ai' ? t('trendingAiTitle') : t('trendingReposTitle'));
    setText('#rankings-description', state.board === 'ai' ? t('aiDescription') : t('generalDescription'));
    setText('#popular-kicker', t('popularNow'));
    setText('#popular-title', t('popularTitle'));
    setText('#popular-description', t('popularDescription'));
    setText('#th-project', t('project'));
    setText('#th-stars', t('stars'));
    setText('#th-seven', t('sevenDay'));
    setText('#th-twenty-eight', t('twentyEightDay'));
    setText('#th-heat', t('heat'));
    setText('#th-category', t('category'));
    setText('#category-kicker', t('aiDirections'));
    setText('#category-title', t('browseDirection'));
    setText('#category-description', t('browseDirectionCopy'));
    setText('#footer-copy', t('footerCopy'));
    qs('#search-input').placeholder = t('searchPlaceholder');
    qs('#search-input').setAttribute('aria-label', t('searchPlaceholder'));
    qs('#language-toggle').textContent = t('languageShort');
    qs('#language-toggle').setAttribute('aria-label', t('languageLabel'));
    qs('#sort-select').setAttribute('aria-label', state.language === 'zh' ? '排序方式' : 'Sort projects');
    var options = qs('#sort-select').options;
    options[0].textContent = t('sortPopular');
    options[1].textContent = t('sortStars');
    options[2].textContent = t('sortRecent');
  }

  function updateBoardLinks() {
    document.querySelectorAll('[data-board-link]').forEach(function (link) {
      var active = link.getAttribute('data-board-link') === state.board;
      link.classList.toggle('active', active);
      link.setAttribute('aria-current', active ? 'page' : 'false');
    });
  }

  function renderStats() {
    var repos = boardRepos();
    var stars = repos.reduce(function (sum, repo) { return sum + Number(repo.stars || 0); }, 0);
    var stats = state.data.stats || {};
    var window = stats.baselineWindow;
    setText('#stat-repos-label', t('trackedProjects'));
    setText('#stat-repos-hint', state.board === 'ai' ? t('discoveredFromGitHub') : t('activeOpenSource'));
    setText('#stat-repos', formatNumber(repos.length));
    setText('#stat-stars-label', t('combinedStars'));
    setText('#stat-stars-hint', t('currentTotals'));
    setText('#stat-stars', formatCompact(stars));
    setText('#stat-category-label', state.board === 'ai' ? t('aiCategories') : t('trackedProjects'));
    setText('#stat-category-hint', state.board === 'ai' ? t('categoryHint') : t('activeOpenSource'));
    setText('#stat-categories', state.board === 'ai' ? formatNumber((state.data.categories || []).length) : formatNumber(repos.length));
    setText('#stat-updated-label', t('dataUpdated'));
    setText('#stat-updated', formatDate(state.data.asOfDate || state.data.generatedAt));
    setText('#stat-baseline', window === '28d' ? t('twentyEightDayReady') : window === '7d' ? t('sevenDayReady') : t('buildingHistory'));
  }

  function renderStatus() {
    var element = qs('#data-status');
    var label = element.querySelector('span:last-child');
    var stats = state.data.stats || {};
    var hasData = Array.isArray(state.data.repos) && state.data.repos.length > 0;
    element.className = 'data-status ' + (hasData ? 'ready' : 'waiting');
    label.textContent = hasData ? t('dataReady') : t('buildingHistoryStatus');
    setText('#freshness-label', state.data.asOfDate ? t('updatedPrefix') + ' ' + formatDate(state.data.asOfDate) : t('loadingLatest'));
    var discovered = state.data.discovery && state.data.discovery.aiCandidates;
    var coverage = state.board === 'ai' && discovered
      ? (state.language === 'zh' ? '已检查 ' + formatNumber(discovered) + ' 个候选项目' : formatNumber(discovered) + ' candidates checked')
      : (state.language === 'zh' ? '持续寻找新项目' : t('discovering'));
    setText('#coverage-label', coverage);
    element.removeAttribute('title');
  }

  function renderTabs() {
    var container = qs('#category-tabs');
    container.innerHTML = '';
    var all = document.createElement('button');
    all.className = 'category-tab' + (state.category === 'All' ? ' active' : '');
    all.dataset.category = 'All';
    all.setAttribute('role', 'tab');
    all.setAttribute('aria-selected', state.category === 'All' ? 'true' : 'false');
    all.textContent = t('all');
    container.appendChild(all);
    if (state.board !== 'ai') return;
    (state.data.categories || []).forEach(function (category) {
      var button = document.createElement('button');
      button.className = 'category-tab' + (state.category === category.key ? ' active' : '');
      button.dataset.category = category.key;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', state.category === category.key ? 'true' : 'false');
      button.textContent = state.language === 'zh' ? category.labelZh : category.label;
      container.appendChild(button);
    });
  }

  function filterRepos() {
    var query = state.query.trim().toLowerCase();
    return boardRepos().filter(function (repo) {
      var matchesCategory = state.category === 'All' || categoriesFor(repo).some(function (category) {
        return category.key === state.category;
      });
      if (!matchesCategory) return false;
      if (!query) return true;
      return String(repo.name || '').toLowerCase().includes(query) ||
        String(repo.description || '').toLowerCase().includes(query) ||
        categoriesFor(repo).some(function (category) {
          return String(category.label || '').toLowerCase().includes(query) ||
            String(category.labelZh || '').toLowerCase().includes(query);
        });
    });
  }

  function sourceLabelsFor(repo) {
    var sourceSignals = Array.isArray(repo.sourceSignals) ? repo.sourceSignals : [];
    var labels = sourceSignals.map(function (signal) {
      return signal.label || signal.source;
    }).filter(Boolean);
    return labels.length ? labels.slice(0, 2).join(' · ') : 'GitHub';
  }

  function repoCard(repo, index) {
    var category = categoriesFor(repo)[0];
    var label = category ? (state.language === 'zh' ? category.labelZh : category.label) : t('openSource');
    var sources = sourceLabelsFor(repo);
    var metric = formatCompact(repo.stars) + ' ' + t('stars');
    return '<a class="spotlight-item" href="' + escapeHtml(repo.url) + '" target="_blank" rel="noreferrer">' +
      '<span class="spotlight-rank">0' + (index + 1) + '</span>' +
      '<img class="spotlight-avatar" src="' + escapeHtml(repo.avatarUrl) + '" alt="" loading="lazy" />' +
      '<span class="spotlight-name">' + escapeHtml(repoNameOnly(repo)) + '<small>' + escapeHtml(ownerName(repo)) + '</small></span>' +
      '<span class="spotlight-metric">' + escapeHtml(metric) + '<small>' + escapeHtml(label + ' · ' + sources) + '</small></span>' +
      '<span class="spotlight-arrow" aria-hidden="true">↗</span>' +
      '</a>';
  }

  function renderSpotlights() {
    var all = boardRepos();
    var popular = sortRepos(all, 'popular').slice(0, 5);
    qs('#popular-list').innerHTML = popular.length
      ? popular.map(function (repo, index) { return repoCard(repo, index); }).join('')
      : '<p class="spotlight-empty">' + escapeHtml(t('noPopularYet')) + '</p>';
  }

  function categoryBadges(repo) {
    var categories = categoriesFor(repo);
    if (!categories.length) return '<span class="category-badge general-badge">' + escapeHtml(t('openSource')) + '</span>';
    return categories.slice(0, 3).map(function (category) {
      var label = state.language === 'zh' ? category.labelZh : category.label;
      var evidence = Array.isArray(category.evidence) ? category.evidence.join(', ') : '';
      var title = label + ' · ' + t('confidenceLabel') + ' ' + Math.round(Number(category.confidence || 0) * 100) + '%' +
        (evidence ? ' · ' + t('evidenceLabel') + ': ' + evidence : '');
      return '<span class="category-badge" title="' + escapeHtml(title) + '" style="color:' + escapeHtml(category.color || '#b6a7ff') + '">' + escapeHtml(label) + '</span>';
    }).join('');
  }

  function growthCell(growth) {
    if (!growth || growth.delta == null) return '<span class="muted-value">—</span>';
    var delta = Number(growth.delta);
    var sign = delta > 0 ? '+' : '';
    var className = delta > 0 ? 'growth-positive' : delta < 0 ? 'growth-negative' : 'muted-value';
    return '<span class="' + className + '">' + escapeHtml(sign + formatCompact(delta)) + '</span>';
  }

  function renderTable() {
    var body = qs('#ranking-body');
    var empty = qs('#empty-state');
    var results = sortRepos(filterRepos(), state.sort).slice(0, 50);
    var note = state.sort === 'popular'
      ? t('currentAttention')
      : state.sort === 'stars'
        ? t('starsSort')
        : t('recentSort');
    setText('#results-caption', state.language === 'zh' ? '前 50 个项目' : 'Top 50 projects');
    setText('#results-note', note);
    empty.hidden = results.length > 0;
    if (!results.length) {
      body.innerHTML = '';
      setText('#empty-title', t('noMatches'));
      setText('#empty-copy', state.query ? t('noMatchesSearch') : t('noMatchesCategory'));
      return;
    }
    body.innerHTML = results.map(function (repo, index) {
      var sourceCount = Number(repo.sourceCount || 1);
      var score = '<span class="number-value">' + Number(repo.attentionScore == null ? repo.popularScore || 0 : repo.attentionScore).toFixed(1) + '</span>' +
        '<small class="score-note">' + sourceCount + ' ' + escapeHtml(t('sourceCountLabel')) + '</small>';
      var language = repo.language ? '<span class="language-pill">' + escapeHtml(repo.language) + '</span>' : '';
      var description = repo.description ? '<p class="repo-description">' + escapeHtml(repo.description) + '</p>' : '';
      return '<tr>' +
        '<td><span class="rank-number' + (index < 3 ? ' top-rank' : '') + '">' + (index + 1) + '</span></td>' +
        '<td><div class="repo-cell"><img class="repo-avatar" src="' + escapeHtml(repo.avatarUrl) + '" alt="" loading="lazy" />' +
          '<div class="repo-details"><div class="repo-name-line"><a class="repo-name" href="' + escapeHtml(repo.url) + '" target="_blank" rel="noreferrer">' +
          escapeHtml(repo.name) + '</a>' + language + '</div>' + description + '</div></div></td>' +
        '<td class="align-right"><span class="number-value">' + escapeHtml(formatNumber(repo.stars)) + '</span></td>' +
        '<td class="align-right">' + growthCell(repo.growth7d) + '</td>' +
        '<td class="align-right">' + growthCell(repo.growth28d) + '</td>' +
        '<td class="align-right">' + score + '</td>' +
        '<td><div class="category-badges">' + categoryBadges(repo) + '</div></td>' +
        '<td><a class="external-link" href="' + escapeHtml(repo.url) + '" target="_blank" rel="noreferrer" aria-label="' + escapeHtml(t('openProject')) + '">↗</a></td>' +
        '</tr>';
    }).join('');
  }

  function renderCategories() {
    var section = qs('#category-section');
    if (state.board !== 'ai') {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    var repos = boardRepos();
    qs('#category-grid').innerHTML = (state.data.categories || []).map(function (category) {
      var items = repos.filter(function (repo) {
        return categoriesFor(repo).some(function (entry) { return entry.key === category.key; });
      });
      var top = sortRepos(items, 'popular')[0];
      var label = state.language === 'zh' ? category.labelZh : category.label;
      var description = state.language === 'zh' ? category.descriptionZh : category.description;
      return '<article class="category-card" style="--category-color:' + escapeHtml(category.color || '#b6a7ff') + '">' +
        '<div class="category-card-head"><h3>' + escapeHtml(label) + '</h3><span class="category-count">' + items.length + ' ' + escapeHtml(t('projectsCount')) + '</span></div>' +
        '<p>' + escapeHtml(description || t('noCategoryProjects')) + '</p>' +
        (top ? '<a class="category-top" href="' + escapeHtml(top.url) + '" target="_blank" rel="noreferrer"><img class="repo-avatar" src="' + escapeHtml(top.avatarUrl) + '" alt="" loading="lazy" /><span>' +
          escapeHtml(t('topLabel')) + ': ' + escapeHtml(top.name) + '</span></a>' : '') +
        '</article>';
    }).join('');
  }

  function render() {
    if (!state.data) return;
    if (state.board !== 'ai') state.category = 'All';
    applyCopy();
    updateBoardLinks();
    renderStats();
    renderStatus();
    renderTabs();
    renderSpotlights();
    renderTable();
    renderCategories();
  }

  function renderError(error) {
    var status = qs('#data-status');
    status.className = 'data-status error';
    status.querySelector('span:last-child').textContent = t('dataUnavailable');
    setText('#freshness-label', t('dataUnavailable'));
    setText('#coverage-label', '');
    qs('#ranking-body').innerHTML = '';
    qs('#empty-state').hidden = false;
    setText('#empty-title', t('dataUnavailable'));
    setText('#empty-copy', error && error.message ? error.message : t('noMatchesSearch'));
  }

  function readBoardFromHash() {
    var hash = window.location.hash.toLowerCase();
    if (hash === '#trending-ai') state.board = 'ai';
    if (hash === '#trending' || hash === '') state.board = 'general';
    render();
  }

  function bindEvents() {
    qs('#language-toggle').addEventListener('click', function () {
      state.language = state.language === 'en' ? 'zh' : 'en';
      try {
        localStorage.setItem('repo-radar-language', state.language);
      } catch (error) {}
      render();
    });
    qs('#search-input').addEventListener('input', function (event) {
      state.query = event.target.value;
      renderTable();
    });
    qs('#sort-select').addEventListener('change', function (event) {
      state.sort = event.target.value;
      renderTable();
    });
    qs('#category-tabs').addEventListener('click', function (event) {
      var button = event.target.closest('[data-category]');
      if (!button) return;
      state.category = button.getAttribute('data-category');
      renderTabs();
      renderSpotlights();
      renderTable();
    });
    window.addEventListener('hashchange', readBoardFromHash);
  }

  function init() {
    bindEvents();
    readBoardFromHash();
    fetch('./data/repos.json', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        state.data = data;
        render();
      })
      .catch(renderError);
  }

  init();
}());
