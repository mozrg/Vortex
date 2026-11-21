const repository = 'mozrg/Vortex';
const releasesApi = `https://api.github.com/repos/${repository}/releases`;
const updatesPage = document.querySelector('[data-updates-page]');
const query = new URLSearchParams(location.search);
const updateTag = updatesPage ? query.get('tag') : null;
const updateNotice = updatesPage ? query.get('notice') : null;
const isUpdateDetail = updateTag !== null || updateNotice !== null;
const releaseTagPattern = /^v?\d+\.\d+\.\d+(?:[-+][\da-z.+-]+)?$/i;
let releaseList = null;
let updateDetail = null;
let releaseListFailed = false;

const copy = {
  ru: {
    navFeatures: 'Возможности', navVersions: 'Версии', eyebrow: 'ТВОЯ СЛЕДУЮЩАЯ ИГРА — БЛИЖЕ', heroTitle: 'Vortex', heroBody: 'Vortex собирает плейсы Roblox в одном удобном лаунчере: поиск по названию, избранное и быстрый запуск.', downloadLatest: 'Скачать последнюю версию', seeVersions: 'Посмотреть версии', platform: 'Для Windows · Бесплатно · Проект на GitHub', releaseLabel: 'ПОСЛЕДНИЙ РЕЛИЗ', releaseNotes: 'История релизов', featuresEyebrow: 'ДЛЯ ТВОЕЙ ИГРОВОЙ ПОЛКИ', featuresTitle: 'Быстрее находи то,<br />во что хочется играть', featureSearch: 'Поиск по названию', featureSearchBody: 'Находи плейсы Roblox по имени или Place ID и переходи к запуску прямо из лаунчера.', searchPlaceholder: 'Например, Blox Fruits', featureLibrary: 'Своя библиотека', featureLibraryBody: 'Сохраняй любимые игры и возвращайся к недавним запускам.', featureLaunch: 'Один быстрый запуск', featureLaunchBody: 'Открой плейс через Roblox deep link, не теряя время на лишние шаги.', launchLabel: 'ЗАПУСТИТЬ', launchReadout: 'до запуска', versionsEyebrow: 'ОБНОВЛЕНИЯ И ФАЙЛЫ', versionsTitle: 'Версии лаунчера', versionsBody: 'Скачивай последнюю сборку или найди предыдущие релизы.', allGithub: 'Все релизы на GitHub', releasesWord: 'релизов', loading: 'Загружаем версии…', updatesNote: 'Лаунчер проверяет новые версии при запуске и загружает обновление автоматически.', footer: 'Сделано, чтобы быстрее находить игры и возвращаться в любимые миры.', noReleases: 'Пока нет опубликованных версий', noReleasesBody: 'Когда появится первый GitHub Release, здесь будут версии и ссылки на установщики.', apiError: 'Не удалось загрузить список версий', apiErrorBody: 'Открой страницу релизов на GitHub или попробуй позже.', version: 'Версия', latest: 'ПОСЛЕДНЯЯ', prerelease: 'БЕТА', stable: 'РЕЛИЗ', download: 'Скачать установщик', checksum: 'SHA-256', noInstaller: 'Установщик пока не загружен', noNotes: 'Описание этого релиза не добавлено.', downloaded: 'загрузок', published: 'Опубликовано', latestAvailable: 'Последняя версия', releaseFallback: 'Открыть релиз на GitHub', showAllNotes: 'Показать все изменения', showLessNotes: 'Свернуть'
  },
  en: {
    navFeatures: 'Features', navVersions: 'Versions', eyebrow: 'YOUR NEXT GAME IS CLOSER', heroTitle: 'Vortex', heroBody: 'Vortex brings Roblox experiences into one launcher: search by name, save favorites, and launch fast.', downloadLatest: 'Download the latest version', seeVersions: 'Browse versions', platform: 'For Windows · Free · Project on GitHub', releaseLabel: 'LATEST RELEASE', releaseNotes: 'Release history', featuresEyebrow: 'MADE FOR YOUR GAME LIBRARY', featuresTitle: 'Find what you want<br />to play, faster', featureSearch: 'Search by name', featureSearchBody: 'Find Roblox experiences by name or Place ID, then launch them from the app.', searchPlaceholder: 'Try Blox Fruits', featureLibrary: 'Your own library', featureLibraryBody: 'Save favorites and return to your recently played experiences.', featureLaunch: 'One quick launch', featureLaunchBody: 'Open a place through the Roblox deep link without extra steps.', launchLabel: 'PLAY NOW', launchReadout: 'to launch', versionsEyebrow: 'UPDATES AND DOWNLOADS', versionsTitle: 'Launcher versions', versionsBody: 'Download the latest build or browse earlier releases.', allGithub: 'All releases on GitHub', releasesWord: 'releases', loading: 'Loading versions…', updatesNote: 'The launcher checks for new versions at startup and downloads updates automatically.', footer: 'Made to help you find games and return to the worlds you love.', noReleases: 'No published versions yet', noReleasesBody: 'When the first GitHub Release is published, its versions and installers will appear here.', apiError: 'Could not load the version list', apiErrorBody: 'Open the releases page on GitHub or try again later.', version: 'Version', latest: 'LATEST', prerelease: 'BETA', stable: 'RELEASE', download: 'Download installer', checksum: 'SHA-256', noInstaller: 'Installer has not been uploaded', noNotes: 'No release notes were added.', downloaded: 'downloads', published: 'Published', latestAvailable: 'Latest version', releaseFallback: 'Open release on GitHub', showAllNotes: 'Show all changes', showLessNotes: 'Collapse'
  }
};

Object.assign(copy.ru, {
  navUpdates: 'Обновления', updatesTitle: 'Обновления Vortex', updatesBody: 'Список изменений и установщики для каждой версии.',
  viewNotes: 'Посмотреть лог', backToUpdates: 'Все обновления', loadNotes: 'Загружаем изменения…',
  notesMissing: 'Обновление не найдено', notesError: 'Не удалось загрузить лог обновления',
  notesErrorBody: 'Попробуй ещё раз или открой список релизов на GitHub.'
});
Object.assign(copy.en, {
  navUpdates: 'Updates', updatesTitle: 'Vortex updates', updatesBody: 'Release notes and installers for every version.',
  viewNotes: 'View changelog', backToUpdates: 'All updates', loadNotes: 'Loading release notes…',
  notesMissing: 'Update not found', notesError: 'Could not load the changelog',
  notesErrorBody: 'Try again or open the list of releases on GitHub.'
});

const storedLanguage = localStorage.getItem('vortex.siteLanguage');
let language = ['ru', 'en'].includes(storedLanguage) ? storedLanguage : (navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en');
const t = (key) => copy[language][key] || copy.ru[key] || key;

function applyLanguage() {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-copy]').forEach((node) => {
    const value = t(node.dataset.copy);
    if (value.includes('<br') || value.includes('<em>')) node.innerHTML = value;
    else node.textContent = value;
  });
  document.getElementById('language-toggle').textContent = language === 'ru' ? 'EN' : 'RU';
  document.getElementById('language-toggle').setAttribute('aria-label', language === 'ru' ? 'Switch language' : 'Сменить язык');
  document.title = updatesPage ? t('updatesTitle') : language === 'ru' ? 'Vortex — лаунчер плейсов' : 'Vortex — Place Launcher';
  document.documentElement.dataset.language = language;
  if (isUpdateDetail && updateDetail) renderUpdateDetail();
  else if (releaseList) renderReleases(releaseList);
  else if (releaseListFailed) renderReleaseListError();
}

document.getElementById('language-toggle').addEventListener('click', () => {
  language = language === 'ru' ? 'en' : 'ru';
  localStorage.setItem('vortex.siteLanguage', language);
  applyLanguage();
});

function createText(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function releaseVersion(release) {
  const value = String(release.tag_name || '').replace(/^v/i, '');
  return /^\d+\.\d+\.\d+(?:[-+][\da-z.-]+)?$/i.test(value) ? value : String(release.tag_name || '');
}

function releaseLogHref(tag) {
  return './updates.html?' + new URLSearchParams({ tag });
}

function releaseDate(release) {
  const date = release.published_at ? new Date(release.published_at) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function releaseAssets(release) {
  const version = releaseVersion(release);
  const assets = Array.isArray(release.assets) ? release.assets : [];
  // The installer name has shipped under both "Vortex Launcher Setup x.exe"
  // and "Vortex-Launcher-Setup-x.exe": match any spacing variant.
  const isInstaller = (name) => {
    const match = /^Vortex[.\s-]*Launcher[.\s-]*Setup[.\s-]*(.+)\.exe$/i.exec(String(name));
    return match?.[1] === version;
  };
  const isChecksum = (name) => isInstaller(String(name).replace(/\.sha256$/i, '')) && /\.sha256$/i.test(String(name));
  return {
    installer: assets.find((asset) => isInstaller(asset.name) && /^https:\/\/github\.com\//i.test(asset.browser_download_url || '')),
    checksum: assets.find((asset) => isChecksum(asset.name) && /^https:\/\/github\.com\//i.test(asset.browser_download_url || ''))
  };
}

// The latest tag sometimes ships without assets yet: pick the newest release
// that actually carries an installer so the big button always downloads.
function releaseWithInstaller(releases) {
  return (releases || []).find((release) => releaseAssets(release).installer) || (releases || [])[0] || null;
}

function setLatestRelease(release) {
  const versionNode = document.getElementById('latest-version');
  if (!versionNode) return;
  const dateNode = document.getElementById('latest-date');
  const link = document.getElementById('latest-release-link');
  const linkLabel = link.querySelector('[data-copy]');
  const download = document.getElementById('hero-download');
  if (!release) {
    versionNode.textContent = t('noReleases');
    dateNode.textContent = '';
    link.href = './updates.html';
    linkLabel.dataset.copy = 'releaseNotes';
    linkLabel.textContent = t('releaseNotes');
    download.href = '#versions';
    download.setAttribute('aria-disabled', 'true');
    return;
  }
  const version = releaseVersion(release);
  const { installer, checksum } = releaseAssets(release);
  versionNode.textContent = `v${version}`;
  dateNode.textContent = releaseDate(release);
  link.href = releaseLogHref(release.tag_name);
  linkLabel.dataset.copy = 'viewNotes';
  linkLabel.textContent = t('viewNotes');
  // Direct file download when the installer asset exists  no release page hop.
  download.href = installer ? installer.browser_download_url : release.html_url;
  download.setAttribute('aria-disabled', installer ? 'false' : 'true');
  download.title = installer ? t('download') : t('noInstaller');
  // File size + checksum inline, so the download is verifiable at a glance.
  const sizeNode = document.getElementById('download-size');
  const checksumLink = document.getElementById('download-checksum');
  if (sizeNode) {
    sizeNode.textContent = installer && installer.size
      ? (installer.size / (1024 * 1024)).toFixed(1) + ' MB  .exe'
      : '';
  }
  if (checksumLink) {
    if (checksum) { checksumLink.href = checksum.browser_download_url; checksumLink.hidden = false; }
    else checksumLink.hidden = true;
  }
}

function renderReleases(releases) {
  const container = document.getElementById('versions-list');
  container.replaceChildren();

  // Release counter chip in the section heading.
  const counter = document.getElementById('versions-count');
  const total = document.getElementById('versions-total');
  if (counter && total) {
    total.textContent = String(releases.length);
    counter.hidden = releases.length === 0;
  }

  if (!releases.length) {
    const empty = createText('div', 'empty-state', '');
    const inner = document.createElement('span');
    inner.innerHTML = `<strong>${escapeHtml(t('noReleases'))}</strong><br />${escapeHtml(t('noReleasesBody'))}`;
    empty.appendChild(inner);
    container.appendChild(empty);
    setLatestRelease(null);
    return;
  }

  // Prefer the newest stable release that actually has an installer asset:
  // the button then always deep-links the file instead of a release page.
  const withInstaller = releases.filter((release) => releaseAssets(release).installer);
  const latestStable = withInstaller.find((release) => !release.prerelease) || withInstaller[0] || releases.find((release) => !release.prerelease) || releases[0];
  setLatestRelease(latestStable);
  const shown = releases.slice(0, 20);
  shown.forEach((release, index) => {
    const { installer, checksum } = releaseAssets(release);
    const version = releaseVersion(release);
    const card = document.createElement('article');
    card.className = 'version-card';

    const head = document.createElement('div');
    head.className = 'version-head';
    const meta = document.createElement('div');
    meta.className = 'version-meta';
    const badge = createText('span', `version-badge${release.prerelease ? ' prerelease' : ''}`, `v${version}`);
    meta.appendChild(badge);
    meta.appendChild(createText('span', 'version-date', releaseDate(release)));
    if (index === 0 && !release.prerelease) badge.title = t('latestAvailable');

    const actions = document.createElement('div');
    actions.className = 'version-actions';
    actions.append(openLink('version-log-link', `${t('viewNotes')} ↗`, releaseLogHref(release.tag_name)));
    if (installer) {
      const link = createText('a', 'version-download', `↓  ${t('download')}`);
      link.href = installer.browser_download_url;
      link.download = installer.name;
      actions.appendChild(link);
      if (checksum) {
        const checksumLink = createText('a', 'checksum-link', t('checksum'));
        checksumLink.href = checksum.browser_download_url;
        checksumLink.target = '_blank';
        checksumLink.rel = 'noreferrer';
        actions.appendChild(checksumLink);
      }
    } else {
      const link = createText('a', 'checksum-link', t('releaseFallback'));
      link.href = release.html_url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      actions.appendChild(link);
    }

    head.append(meta, actions);

    card.appendChild(head);
    container.appendChild(card);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function openLink(className, label, href) {
  const link = createText('a', className, label);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function noticeReleaseTag(item) {
  const releaseUrl = /^https:\/\/github\.com\/mozrg\/Vortex\/releases\/tag\/([^/?#]+)/i.exec(item.url || '');
  const titleTag = String(item.title ?? '').trim().replace(/^Vortex\s+/i, '');
  return [item.releaseTag, releaseUrl?.[1], titleTag]
    .find(tag => typeof tag === 'string' && releaseTagPattern.test(tag)) || '';
}

async function fetchReleaseByTag(tag) {
  if (!releaseTagPattern.test(tag) || tag.length > 80) return null;
  const alternate = /^v/i.test(tag) ? tag.slice(1) : 'v' + tag;
  for (const candidate of [tag, alternate]) {
    const response = await fetch(`${releasesApi}/tags/${encodeURIComponent(candidate)}`, { headers: { Accept: 'application/vnd.github+json' } });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const release = await response.json();
    return release.draft ? null : release;
  }
  return null;
}

async function fetchNotices() {
  const response = await fetch('./notifications.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Notifications returned ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.items) ? data.items : [];
}

async function loadUpdateDetail() {
  try {
    let notice = null;
    let release = null;
    if (updateNotice !== null) {
      const notices = await fetchNotices();
      notice = notices.find(item => item.id === updateNotice);
      const tag = notice && noticeReleaseTag(notice);
      if (tag && !notice.updateLog?.trim()) release = await fetchReleaseByTag(tag).catch(() => null);
    } else if (updateTag.length <= 80 && releaseTagPattern.test(updateTag)) {
      const version = updateTag.replace(/^v/i, '');
      const [notices, result] = await Promise.all([
        fetchNotices().catch(() => []),
        fetchReleaseByTag(updateTag).then(release => ({ release }), error => ({ error }))
      ]);
      notice = notices.filter(item => item.updateLog?.trim() && noticeReleaseTag(item).replace(/^v/i, '') === version)
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
      release = result.release;
      if (!notice && result.error) throw result.error;
    }
    updateDetail = { notice, release };
  } catch (error) {
    console.warn('Could not load Vortex changelog:', error);
    updateDetail = { error: true };
  }
  renderUpdateDetail();
}

function renderUpdateDetail() {
  const container = document.getElementById('versions-list');
  const { notice, release, error } = updateDetail;
  if (!notice && !release) {
    const empty = createText('div', 'empty-state', '');
    const inner = document.createElement('div');
    inner.append(createText('strong', '', t(error ? 'notesError' : 'notesMissing')), createText('p', '', t('notesErrorBody')));
    empty.appendChild(inner);
    container.replaceChildren(empty);
    return;
  }
  const tag = release?.tag_name || (notice && noticeReleaseTag(notice));
  const title = tag ? 'Vortex ' + tag.replace(/^v/i, '') : notice.title;
  const heading = document.getElementById('updates-title');
  heading.removeAttribute('data-copy');
  heading.textContent = title;
  document.title = `${title} · ${t('navUpdates')}`;

  const article = document.createElement('article');
  article.className = 'update-detail';
  const meta = document.createElement('div');
  meta.className = 'version-head update-detail-meta';
  const publishedAt = release?.published_at || notice?.date;
  const date = releaseDate({ published_at: publishedAt });
  if (date) {
    const time = createText('time', 'version-date', date);
    time.dateTime = publishedAt;
    meta.appendChild(time);
  }
  if (release) {
    const actions = document.createElement('div');
    actions.className = 'version-actions';
    const { installer, checksum } = releaseAssets(release);
    if (installer) actions.append(openLink('version-download', t('download'), installer.browser_download_url));
    if (checksum) actions.append(openLink('checksum-link', t('checksum'), checksum.browser_download_url));
    actions.append(openLink('checksum-link', 'GitHub ↗', release.html_url));
    meta.appendChild(actions);
  }
  if (meta.childElementCount) article.appendChild(meta);
  const body = [notice?.updateLog, release?.body, notice?.body].find(value => typeof value === 'string' && value.trim());
  const notes = createText('div', 'version-notes', '');
  if (body) window.VortexMarkdown.render(notes, body, { headingOffset: 1 });
  else notes.appendChild(createText('p', 'version-notes-empty', t('noNotes')));
  article.appendChild(notes);
  container.replaceChildren(article);
}

function renderReleaseListError() {
  const versionNode = document.getElementById('latest-version');
  if (versionNode) {
    versionNode.textContent = t('apiError');
    document.getElementById('hero-download').setAttribute('aria-disabled', 'true');
  }
  const empty = createText('div', 'empty-state', '');
  const inner = document.createElement('span');
  inner.innerHTML = `<strong>${escapeHtml(t('apiError'))}</strong><br />${escapeHtml(t('apiErrorBody'))}`;
  empty.appendChild(inner);
  document.getElementById('versions-list').replaceChildren(empty);
}

async function loadReleases() {
  try {
    const response = await fetch(`${releasesApi}?per_page=30`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const releases = await response.json();
    if (!Array.isArray(releases)) throw new Error('Unexpected release list');
    releaseList = releases.filter((release) => !release.draft);
    renderReleases(releaseList);
  } catch (error) {
    console.warn('Could not load Vortex releases:', error);
    releaseListFailed = true;
    renderReleaseListError();
  }
}

document.getElementById('year').textContent = new Date().getFullYear();
applyLanguage();
if (isUpdateDetail) {
  document.querySelector('[data-updates-description]').hidden = true;
  document.querySelector('[data-copy="loadNotes"]').textContent = t('loadNotes');
  void loadUpdateDetail();
} else {
  document.querySelector('.updates-back')?.setAttribute('hidden', '');
  const loading = document.querySelector('[data-copy="loadNotes"]');
  if (loading) {
    loading.dataset.copy = 'loading';
    loading.textContent = t('loading');
  }
  void loadReleases();
}
