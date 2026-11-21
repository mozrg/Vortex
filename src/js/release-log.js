const releaseLogRoutes = new Map();
let shownReleaseLog = null;

function announcementReleaseTag(item) {
  const releaseUrl = /^https:\/\/github\.com\/mozrg\/Vortex\/releases\/tag\/([^/?#]+)/i.exec(item.url || '');
  const titleTag = String(item.title ?? '').trim().replace(/^Vortex\s+/i, '');
  const candidates = [item.releaseTag, releaseUrl?.[1], titleTag];
  return candidates.find(tag => typeof tag === 'string' && /^v?\d+\.\d+\.\d+(?:[-+][\da-z.+-]+)?$/i.test(tag)) || '';
}

function announcementHasLog(item) {
  return Boolean(announcementReleaseTag(item) || String(item.updateLog ?? '').trim());
}

function routeToReleaseLog(item) {
  const route = 'release-log/' + (item.id || announcementReleaseTag(item));
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
  if (!String(entry.item.updateLog ?? '').trim() && entry.status === 'idle') {
    const tag = announcementReleaseTag(entry.item);
    if (tag) void loadReleaseLog(route, entry, tag);
  }
}

async function loadReleaseLog(route, entry, tag) {
  entry.status = 'loading';
  updateReleaseLogContent(route, entry);
  try {
    entry.release = await window.vortexDesktop?.getAnnouncementReleaseLog?.(tag);
    entry.status = entry.release ? 'ready' : 'error';
  } catch {
    entry.status = 'error';
  }
  updateReleaseLogContent(route, entry);
}

function updateReleaseLogContent(route, entry) {
  if (currentView !== 'release-log' || shownReleaseLog !== route || releaseLogRoutes.get(route) !== entry) return;
  const content = document.querySelector('.release-log-content');
  if (content) content.innerHTML = renderReleaseLogContent(entry);
}

function renderReleaseLogContent({ item, status, release }) {
  const body = [item.updateLog, release?.body, item.body]
    .find(value => typeof value === 'string' && value.trim());
  const message = status === 'loading' ? 'notifications.loadingLog'
    : status === 'error' ? 'notifications.logUnavailable'
      : body ? '' : 'notifications.logEmpty';
  return `${message ? `<p class="release-log-status">${t(message)}</p>` : ''}
    ${body ? `<div class="announcement-body release-log-body">${window.VortexMarkdown.toHtml(body, { headingOffset: 1 })}</div>` : ''}`;
}

function renderReleaseLog() {
  const entry = releaseLogRoutes.get(shownReleaseLog);
  if (!entry) return '';
  const { item } = entry;
  const date = new Date(item.date ?? '');
  const dateLabel = Number.isNaN(date.getTime()) ? ''
    : date.toLocaleDateString(preferences.language === 'en' ? 'en-US' : 'ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  return `<article class="settings-card release-log-page">
    <header class="release-log-head">
      <span>${t('notifications.logTitle')}</span>
      <h1 tabindex="-1">${escapeHtml(item.title)}</h1>
      ${dateLabel ? `<time datetime="${date.toISOString()}">${dateLabel}</time>` : ''}
    </header>
    <div class="release-log-content" aria-live="polite">${renderReleaseLogContent(entry)}</div>
  </article>`;
}
