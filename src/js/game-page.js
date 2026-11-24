const gamePanes = ['overview', 'media', 'servers', 'friends', 'launch', 'other'];
const gamePageState = new Map();
const serverIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function gamePageView(id) {
  const key = String(id);
  if (!gamePageState.has(key)) gamePageState.set(key, {
    pane: 'overview', media: 0, serverMode: 'all', serverRegion: 'all', serverSearch: '', pages: new Map(), launching: false
  });
  return gamePageState.get(key);
}

function officialGameUrl(game) {
  const id = String(game?.id || '');
  return gameIdPattern.test(id) ? 'https://www.roblox.com/games/' + id : '';
}

function gamePageStats(game) {
  const { totals, gamesById } = playtimeForView();
  const key = experienceKey(game);
  const total = totals.get(key);
  let weekly = 0;
  let lastLaunch = 0;
  const today = activityDateKey();
  for (let offset = -6; offset <= 0; offset++) {
    const day = activityData.days[shiftActivityDate(today, offset)];
    weekly += groupedPlaytime(day?.games, gamesById).get(key)?.seconds || 0;
  }
  for (const [id, stat] of Object.entries(playStats)) {
    if (experienceKey(gamesById.get(id) || { id }) === key) lastLaunch = Math.max(lastLaunch, Number(stat.lastLaunchAt) || 0);
  }
  lastLaunch = Math.max(lastLaunch, gamePageView(game.id).lastJournalStart || 0);
  return { total: total?.seconds || 0, weekly, lastLaunch };
}

function loadGamePageJournal(game) {
  const view = gamePageView(game.id);
  const key = experienceKey(game);
  if (view.journalExperience === key) return;
  view.journalExperience = key;
  const { gamesById } = playtimeForView();
  void sessionJournal.recent(0, null, row => experienceKey(gamesById.get(String(row.gameId)) || { id: row.gameId }) === key)
    .catch(() => [])
    .then(rows => {
      if (view.journalExperience !== key) return;
      view.lastJournalStart = rows[0]?.startedAt || 0;
      if (isCurrentGamePage(game.id, 'overview')) renderPage();
    });
}

function gamePageDate(value, withTime = false) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return '—';
  if (withTime) {
    const distance = activityDayDistance(activityDateKey(date.getTime()), activityDateKey());
    if (distance === 0 || distance === 1) {
      return t(distance ? 'place.yesterday' : 'place.today') + ' · ' +
        new Intl.DateTimeFormat(preferences.language, { timeStyle: 'short' }).format(date);
    }
  }
  return new Intl.DateTimeFormat(preferences.language, { dateStyle: 'medium' }).format(date);
}

function gamePageMedia(game) {
  const items = new Map();
  for (const media of [...(Array.isArray(game.media) ? game.media : []), ...(Array.isArray(game.screenshots) ? game.screenshots : [])]) {
    if (!media || typeof media !== 'object') continue;
    if (media.type === 'video') {
      const clip = safeExternalUrl(media.externalUrl) || officialGameUrl(game);
      if (clip) items.set(clip, { type: 'video', url: clip, title: media.title });
    } else {
      const art = safeThumbnail(media.url);
      if (art) items.set(art, { type: 'image', url: art, title: media.altText || media.title });
    }
  }
  return [...items.values()];
}

function gamePageTabs(view) {
  const glyphs = { overview: 'board', media: 'image', servers: 'server', friends: 'users', launch: 'sliders', other: 'dots' };
  return `<nav class="game-page-tabs" role="tablist" aria-label="${t('place.tabs')}">
    ${gamePanes.map(pane => `<button type="button" role="tab" id="game-pane-${pane}" data-game-pane="${pane}"
      data-tooltip="${escapeHtml(t('place.tabTip.' + pane))}"
      aria-selected="${view.pane === pane}" aria-controls="game-page-panel" tabindex="${view.pane === pane ? 0 : -1}">
      ${icon(glyphs[pane], 14)} ${t('place.' + pane)}<span class="game-page-tab-line" aria-hidden="true"></span></button>`).join('')}
  </nav>`;
}

function gameDisplayTitle(game) {
  if (!game) return '';
  const alias = String(preferences.gameAliases?.[String(game.id)] || '').trim();
  return alias || String(game.title || '');
}

function renderGameDetail() {
  const game = detailGame;
  if (!game) return `<div class="empty-state"><h2>${t('game.detailNotFound')}</h2><button class="ghost-button" data-nav="catalog">${t('empty.openCatalog')}</button></div>`;
  const id = String(game.id);
  const view = gamePageView(id);
  const media = gamePageMedia(game);
  const art = media.find(item => item.type === 'image')?.url || safeThumbnail(game.icon || game.thumbnail);
  const unavailable = game.availability === 'unavailable';
  const likes = Number(game.upVotes) || 0;
  const dislikes = Number(game.downVotes) || 0;
  const voteSummary = likes + dislikes ? `<span class="game-page-votes" aria-label="${escapeHtml(t('place.voteCounts', { likes, dislikes }))}">
    <span>${icon('thumb', 15)} ${formatCount(likes)}</span><span>${icon('thumb', 15)} ${formatCount(dislikes)}</span></span>` : '';
  const official = officialGameUrl(game);
  const voteMarkup = voteSummary && official ? `<button type="button" class="game-page-vote-button" data-action="open-social-link" data-url="${official}"
    data-tooltip="${t('place.rateOnRoblox')}" aria-label="${escapeHtml(t('place.voteCounts', { likes, dislikes }) + ' · ' + t('place.rateOnRoblox'))}">${voteSummary}</button>` : voteSummary;
  scheduleGamePageData(game, view);
  const pane = {
    overview: () => renderGameOverview(game, likes, dislikes),
    media: () => renderGameMedia(media, view),
    servers: () => renderGameServers(game, view),
    friends: () => renderGameFriendsPage(game),
    launch: () => renderGameLaunch(game),
    other: () => renderGameOther(game)
  }[view.pane]();
  return `<article class="game-detail game-page">
    <div class="game-page-heading">
    <header class="game-page-hero" ${art ? `style="--place-hero-art:url('${escapeHtml(art)}')"` : ''}>
      <button class="game-page-back" type="button" data-action="detail-back" data-tooltip="${escapeHtml(t('place.backTip'))}">${icon('arrowLeft', 15)} ${t('game.backToCatalog')}</button>
      <div class="game-page-hero-main">
        <div class="game-page-title"><h1>${escapeHtml(gameDisplayTitle(game))}</h1>
          <span>${preferences.gameAliases?.[id] ? `${escapeHtml(game.title)} · ` : ''}${escapeHtml(game.creator || t('game.unknownCreator'))}${renderVerifiedCreatorBadge(game)}</span>
        </div>
        <div class="game-page-hero-actions">${voteMarkup}
          <button type="button" class="ghost-button game-page-favorite" data-action="favorite" data-id="${escapeHtml(id)}"
            data-tooltip="${escapeHtml(t(favorites.has(id) ? 'place.favoriteRemoveTip' : 'place.favoriteAddTip'))}"
            aria-pressed="${favorites.has(id)}">${icon('star', 15)} ${t(favorites.has(id) ? 'place.favorited' : 'place.favorite')}</button>
          <button type="button" class="primary-button game-page-play" data-game-page-action="play"
            data-tooltip="${escapeHtml(t('place.playTip'))}"
            ${unavailable || !official || view.launching ? 'disabled' : ''}>
            ${icon('play', 15)} ${t(unavailable ? 'game.notAvailable' : view.launching ? 'tools.loading' : 'card.play')}
          </button>
        </div>
      </div>
    </header>
    ${gamePageTabs(view)}
    </div>
    <div class="game-page-panel" id="game-page-panel" role="tabpanel" aria-labelledby="game-pane-${view.pane}">
      ${detailStatus === 'error' ? `<p class="catalog-disclaimer">${t('game.detailsUnavailable')}</p>` : ''}
      ${pane}
    </div>
  </article>`;
}

function gamePageFacts(game) {
  const entries = [
    ['Place ID', String(game.id)],
    [t('game.author'), game.creator || t('game.unknownCreator'), renderVerifiedCreatorBadge(game)],
    [t('game.updated'), gamePageDate(game.updated)],
    [t('game.genre'), game.genre || t('genre.other')],
    [t('game.access'), game.availability === 'unavailable' ? t('game.notAvailable') :
      Number(game.price) > 0 ? t('game.paid', { price: formatCount(game.price) + ' R$' }) : t('game.free')],
    [t('game.online'), formatCount(game.playing ?? game.playerCount)],
    [t('game.visits'), formatCount(game.visits)],
    [t('game.favorites'), formatCount(game.favorites)]
  ];
  const onlineLabel = detailOnlineUpdatedAt ? t('game.onlineUpdated', {
    time: new Intl.DateTimeFormat(preferences.language, { timeStyle: 'short' }).format(detailOnlineUpdatedAt)
  }) : t('game.refreshOnline');
  return `<section class="game-page-card game-page-facts"><header class="game-page-card-head"><h2>${t('place.aboutGame')}</h2>
    <button class="ghost-button game-page-icon-button" data-action="refresh-online" aria-label="${t('game.refreshOnline')}"
      data-tooltip="${escapeHtml(onlineLabel)}" ${detailOnlineRefreshing ? 'disabled' : ''}>${icon('refreshCw', 14)}</button></header><dl>${entries.map(([label, value, badge = '']) =>
    `<div><dt>${label}</dt><dd>${escapeHtml(value)}${badge}</dd></div>`).join('')}</dl></section>`;
}

function renderGamePersonalNoteCard(game) {
  const id = String(game.id);
  const alias = String(preferences.gameAliases?.[id] || '');
  const note = String(preferences.gameNotes?.[id] || '');
  return `<section class="game-page-card game-personal-note-card">
    <header class="game-page-card-head"><h2>${t('place.noteTitle')}</h2></header>
    <div class="game-note-fields">
      <label class="game-note-field">
        <span>${t('place.aliasLabel')}</span>
        <input type="text" maxlength="64" data-game-alias-input="${escapeHtml(id)}" value="${escapeHtml(alias)}" placeholder="${escapeHtml(game.title || '')}" />
      </label>
      <label class="game-note-field">
        <span>${t('place.noteLabel')}</span>
        <textarea rows="3" maxlength="500" data-game-note-input="${escapeHtml(id)}" placeholder="${escapeHtml(t('place.notePlaceholder'))}">${escapeHtml(note)}</textarea>
      </label>
    </div>
  </section>`;
}

function renderGameOverview(game, likes, dislikes) {
  const { total, weekly, lastLaunch } = gamePageStats(game);
  const ratio = likes + dislikes ? Math.round(likes / (likes + dislikes) * 100) : null;
  const description = String(game.description || t('game.fallbackDescription')).trim();
  return `<div class="game-page-columns">
    <div>
      <div class="game-page-metrics">
        <div><span>${t('game.playtime')}</span><strong>${activityDuration(total)}</strong></div>
        <div><span>${t('place.week')}</span><strong>${activityDuration(weekly)}</strong></div>
        <div><span>${t('place.score')}</span><strong>${ratio === null ? '—' : ratio + '%'}</strong>
          ${ratio === null ? '' : `<span class="game-page-score-track"><i style="width:${ratio}%"></i></span>`}</div>
        <div><span>${t('place.lastLaunch')}</span><strong>${gamePageDate(lastLaunch, true)}</strong></div>
      </div>
      <section class="game-page-card game-page-description">
        <h2>${t('game.description')}</h2>
        <p class="detail-description ${detailDescriptionExpanded ? 'expanded' : 'collapsed'}">${escapeHtml(description)}</p>
        ${description.length > 420 ? `<button class="ghost-button" data-action="toggle-detail-description" aria-expanded="${detailDescriptionExpanded}">${t(detailDescriptionExpanded ? 'card.readLess' : 'card.readMore')}</button>` : ''}
      </section>
      ${renderGameExtraInfo(game)}
    </div>
    <aside>${renderGameFriendSection(game, true)}${renderGamePersonalNoteCard(game)}${gamePageFacts(game)}</aside>
  </div>`;
}

function renderGameMedia(media, view) {
  if (!media.length) return gamePageEmpty('image', detailStatus === 'loading' ? 'game.loadingDetails' : 'place.noMedia');
  view.media = Math.min(view.media, media.length - 1);
  const selected = media[view.media];
  const thumbnail = (item, index) => `<button type="button" class="game-page-thumbnail" data-game-page-action="media-select" data-index="${index}"
      aria-label="${escapeHtml(t('place.mediaIndex', { index: index + 1, total: media.length }))}" aria-pressed="${view.media === index}">
    ${item.type === 'image' ? `<img src="${escapeHtml(item.url)}" alt="" loading="lazy">` : icon('film', 22)}</button>`;
  return `<div class="game-page-gallery">
    <figure class="game-page-media-main">
      <span class="game-page-media-count">${t('place.mediaIndex', { index: view.media + 1, total: media.length })}</span>
      ${selected.type === 'image' ? `<img src="${escapeHtml(selected.url)}" alt="${escapeHtml(selected.title || t('game.screenshots'))}">`
        : `<div class="game-page-video">${icon('film', 34)}
          <button class="primary-button" data-action="open-social-link" data-url="${escapeHtml(selected.url)}">${t('place.watchVideo')}</button></div>`}
      ${media.length > 1 ? `<button class="game-page-media-arrow" data-game-page-action="media-prev" aria-label="${t('game.previousMedia')}">${icon('chevronLeft', 20)}</button>
        <button class="game-page-media-arrow" data-game-page-action="media-next" aria-label="${t('game.nextMedia')}">${icon('chevronRight', 20)}</button>` : ''}
      ${selected.title ? `<figcaption>${escapeHtml(selected.title)}</figcaption>` : ''}
    </figure>
    <div class="game-page-thumbnails">${media.map(thumbnail).join('')}</div>
  </div>`;
}

function gamePageEmpty(glyph, message) {
  return `<div class="game-page-empty" role="status">${icon(glyph, 21)}<p>${t(message)}</p></div>`;
}

function renderGameExtraInfo(game) {
  const allBadges = Array.isArray(game.badges) ? game.badges : [];
  const visibleBadges = detailBadgesExpanded ? allBadges.slice(0, detailBadgeCount) : [];
  const badges = allBadges.length ? `<section class="detail-section"><div class="detail-section-heading"><h2>${icon('award', 15)} ${t('game.badges')}</h2><button class="ghost-button" data-action="toggle-badges">${t(detailBadgesExpanded ? 'game.hideBadges' : 'game.showBadges')}</button></div>${detailBadgesExpanded ? `<div class="detail-badges">${visibleBadges.map((badge) => `<span class="detail-badge">${badge.icon ? `<img src="${escapeHtml(badge.icon)}" alt="" loading="lazy" decoding="async" />` : `<span class="detail-badge-fallback">${icon('award', 18)}</span>`}<strong>${escapeHtml(badge.name)}</strong>${badge.description ? `<small>${escapeHtml(badge.description)}</small>` : ''}</span>`).join('')}</div>${visibleBadges.length < allBadges.length ? `<button class="ghost-button" data-action="show-more-badges">${t('game.showMoreBadges')}</button>` : ''}` : ''}</section>` : '';
  const social = Array.isArray(game.socialLinks) && game.socialLinks.length ? `<section class="detail-section"><h2>${icon('link', 15)} ${t('game.socialLinks')}</h2><div class="detail-social-links">${game.socialLinks.map((link) => {
    const href = safeExternalUrl(link.url);
    if (!href) return '';
    const label = link.title || link.type || new URL(href).hostname.replace(/^www\./, '');
    const platform = String(link.type || label).toLowerCase();
    const platformLabel = /discord/.test(platform) ? 'Discord' : /youtube|video/.test(platform) ? 'YouTube' : /twitter|x\.com/.test(platform) ? 'X' : /tiktok/.test(platform) ? 'TikTok' : /roblox/.test(platform) ? 'Roblox' : label;
    const platformIcon = /discord/.test(platform) ? 'discord' : /youtube|video/.test(platform) ? 'youtube' : /twitter|x\.com/.test(platform) ? 'twitter' : /tiktok/.test(platform) ? 'tiktok' : /roblox/.test(platform) ? 'roblox' : 'link';
    return `<button class="detail-social-card" type="button" data-action="open-social-link" data-url="${escapeHtml(href)}"><span class="social-platform-icon">${icon(platformIcon, 20)}</span><span><strong>${escapeHtml(platformLabel)}</strong><small>${escapeHtml(href.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</small></span></button>`;
  }).join('')}</div></section>` : '';
  const releaseHistory = Array.isArray(game.releaseHistory) && game.releaseHistory.length > 1
    ? `<section class="detail-section"><h2>${t('game.releaseHistory')}</h2><div class="release-history">${game.releaseHistory.slice(0, 8).map((entry) => `<div class="release-row"><span class="release-dot"></span><span><strong>${escapeHtml(new Date(entry.updated).toLocaleDateString(preferences.language === 'en' ? 'en-US' : 'ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }))}</strong><small>${t('game.releaseSeen')}</small></span></div>`).join('')}</div><p class="catalog-disclaimer">${t('game.releaseHistoryHint')}</p></section>`
    : '';
  return badges + social + releaseHistory;
}
