const releaseLogRoutes = new Map();
let shownReleaseLog = null;
const allReleaseLogsState = { status: 'idle', items: [], loadedAt: 0 };

function announcementReleaseTag(item) {
  const releaseUrl = /^https:\/\/github\.com\/mozrg\/Vortex\/releases\/tag\/([^/?#]+)/i.exec(item.url || '');
  const titleTag = String(item.title ?? '').trim().replace(/^Vortex\s+/i, '');
  const candidates = [item.releaseTag, releaseUrl?.[1], titleTag];
  return candidates.find(tag => typeof tag === 'string' && /^v?\d+\.\d+\.\d+(?:[-+][\da-z.+-]+)?$/i.test(tag)) || '';
}

function normalizeReleaseTagKey(tag) {
  return String(tag || '').trim().toLowerCase().replace(/^v/, '');
}

function announcementHasLog(item) {
  return Boolean(announcementReleaseTag(item) || String(item.updateLog ?? '').trim());
}

function routeToReleaseLog(item) {
  const route = 'release-log/' + (item.id || announcementReleaseTag(item) || 'all');
  const existing = releaseLogRoutes.get(route);
  if (!existing || existing.item !== item || existing.status === 'error') {
    releaseLogRoutes.set(route, { item, status: 'idle', release: null });
  }
  showReleaseLog(route);
}

function showReleaseLog(route, { track = true } = {}) {
  const entry = releaseLogRoutes.get(route);
  if (!entry) return;
  closeAnnouncementsPanel();
  shownReleaseLog = route;
  setView('release-log', { track: false });
  if (track) pushNavigationHistory(route);
  const area = document.querySelector('.main-area');
  if (area) area.scrollTop = 0;
  document.querySelector('.release-log-page h1')?.focus({ preventScroll: true });
  const stale = Date.now() - allReleaseLogsState.loadedAt > 5 * 60 * 1000;
  if (allReleaseLogsState.status === 'idle' || allReleaseLogsState.status === 'error' || stale) {
    void loadAllReleaseLogs(route, entry);
  }
}

async function loadAllReleaseLogs(route, entry) {
  allReleaseLogsState.status = 'loading';
  updateReleaseLogContent(route, entry);
  try {
    const list = await window.vortexDesktop?.getAllReleaseLogs?.();
    if (Array.isArray(list)) {
      allReleaseLogsState.items = list;
      allReleaseLogsState.loadedAt = Date.now();
      allReleaseLogsState.status = 'ready';
    } else {
      allReleaseLogsState.status = 'error';
    }
  } catch {
    allReleaseLogsState.status = 'error';
  }
  updateReleaseLogContent(route, entry);
}

function updateReleaseLogContent(route, entry) {
  if (currentView !== 'release-log' || shownReleaseLog !== route || releaseLogRoutes.get(route) !== entry) return;
  const content = document.querySelector('.release-log-content');
  if (content) content.innerHTML = renderReleaseLogContent(entry);
}

function formatReleaseDate(dateStr) {
  const date = new Date(dateStr ?? '');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(preferences.language === 'en' ? 'en-US' : 'ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

function renderReleaseLogContent({ item }) {
  const activeTag = normalizeReleaseTagKey(announcementReleaseTag(item));
  const combined = [];
  const seenTags = new Set();

  // Include all GitHub releases first (newest to oldest)
  for (const rel of allReleaseLogsState.items) {
    const key = normalizeReleaseTagKey(rel.tag || rel.name);
    if (key) seenTags.add(key);
    combined.push({
      tag: rel.tag || rel.name || '',
      title: rel.name || rel.tag || '',
      date: rel.date || '',
      body: rel.body || '',
      url: rel.url || '',
      highlighted: Boolean(activeTag && key === activeTag)
    });
  }

  // If the clicked announcement has a local updateLog or tag not yet in GitHub releases, show it at the top.
  const localBody = String(item?.updateLog || item?.body || '').trim();
  if (item && (!activeTag || !seenTags.has(activeTag)) && localBody) {
    combined.unshift({
      tag: announcementReleaseTag(item) || '',
      title: item.title || '',
      date: item.date || '',
      body: localBody,
      url: item.url || '',
      highlighted: true
    });
  }

  const statusMsg = allReleaseLogsState.status === 'loading' && !combined.length
    ? `<p class="release-log-status">${t('notifications.loadingLog')}</p>`
    : allReleaseLogsState.status === 'error' && !combined.length
      ? `<p class="release-log-status">${t('notifications.logUnavailable')}</p>`
      : !combined.length
        ? `<p class="release-log-status">${t('notifications.logEmpty')}</p>`
        : '';

  if (!combined.length) return statusMsg;

  return `${allReleaseLogsState.status === 'loading' ? `<p class="release-log-status">${t('notifications.loadingLog')}</p>` : ''}
    <div class="release-log-list">${combined.map(rel => {
      const dateLabel = formatReleaseDate(rel.date);
      const bodyHtml = rel.body
        ? window.VortexMarkdown.toHtml(rel.body, { headingOffset: 2 })
        : `<p class="release-log-status">${t('notifications.logEmpty')}</p>`;
      return `<section class="release-log-entry ${rel.highlighted ? 'is-highlighted' : ''}">
        <header class="release-log-entry-head">
          <div class="release-log-entry-title">
            ${rel.tag ? `<span class="release-log-tag">${escapeHtml(rel.tag)}</span>` : ''}
            <h2>${escapeHtml(rel.title)}</h2>
          </div>
          ${dateLabel ? `<time>${escapeHtml(dateLabel)}</time>` : ''}
        </header>
        <div class="announcement-body release-log-body">${bodyHtml}</div>
      </section>`;
    }).join('')}</div>`;
}

function renderReleaseLog() {
  const entry = releaseLogRoutes.get(shownReleaseLog);
  if (!entry) return '';
  return `<article class="settings-card release-log-page">
    <header class="release-log-head">
      <span>${preferences.language === 'en' ? 'Changelog' : 'История версий'}</span>
      <h1 tabindex="-1">${t('notifications.logTitle')}</h1>
    </header>
    <div class="release-log-content" aria-live="polite">${renderReleaseLogContent(entry)}</div>
  </article>`;
}
