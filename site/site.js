const repository = 'mozrg/Vortex';
const releasesApi = `https://api.github.com/repos/${repository}/releases?per_page=30`;

const copy = {
  ru: {
    navFeatures: 'Возможности', navVersions: 'Версии', eyebrow: 'ТВОЯ СЛЕДУЮЩАЯ ИГРА — БЛИЖЕ', heroTitle: 'Найди свой мир.<br /><em>Запусти в один клик.</em>', heroBody: 'Vortex собирает плейсы Roblox в одном удобном лаунчере: поиск по названию, избранное и быстрый запуск.', downloadLatest: 'Скачать последнюю версию', seeVersions: 'Посмотреть версии', platform: 'Для Windows · Бесплатно · Проект на GitHub', releaseLabel: 'ПОСЛЕДНИЙ РЕЛИЗ', releaseNotes: 'История релизов', featuresEyebrow: 'ДЛЯ ТВОЕЙ ИГРОВОЙ ПОЛКИ', featuresTitle: 'Быстрее находи то,<br />во что хочется играть', featureSearch: 'Поиск по названию', featureSearchBody: 'Находи плейсы Roblox по имени или Place ID и переходи к запуску прямо из лаунчера.', searchPlaceholder: 'Например, Blox Fruits', featureLibrary: 'Своя библиотека', featureLibraryBody: 'Сохраняй любимые игры и возвращайся к недавним запускам.', featureLaunch: 'Один быстрый запуск', featureLaunchBody: 'Открой плейс через Roblox deep link, не теряя время на лишние шаги.', launchLabel: 'ЗАПУСТИТЬ', versionsEyebrow: 'ОБНОВЛЕНИЯ И ФАЙЛЫ', versionsTitle: 'Версии лаунчера', versionsBody: 'Скачивай последнюю сборку или найди предыдущие релизы.', allGithub: 'Все релизы на GitHub', loading: 'Загружаем версии…', updatesNote: 'Лаунчер проверяет новые версии при запуске и загружает обновление автоматически.', footer: 'Сделано, чтобы быстрее находить игры и возвращаться в любимые миры.', noReleases: 'Пока нет опубликованных версий', noReleasesBody: 'Когда появится первый GitHub Release, здесь будут версии и ссылки на установщики.', apiError: 'Не удалось загрузить список версий', apiErrorBody: 'Открой страницу релизов на GitHub или попробуй позже.', version: 'Версия', latest: 'ПОСЛЕДНЯЯ', prerelease: 'БЕТА', stable: 'РЕЛИЗ', download: 'Скачать установщик', checksum: 'SHA-256', noInstaller: 'Установщик пока не загружен', noNotes: 'Описание этого релиза не добавлено.', downloaded: 'загрузок', published: 'Опубликовано', latestAvailable: 'Последняя версия', releaseFallback: 'Открыть релиз на GitHub'
  },
  en: {
    navFeatures: 'Features', navVersions: 'Versions', eyebrow: 'YOUR NEXT GAME IS CLOSER', heroTitle: 'Find your world.<br /><em>Launch in one click.</em>', heroBody: 'Vortex brings Roblox experiences into one launcher: search by name, save favorites, and launch fast.', downloadLatest: 'Download the latest version', seeVersions: 'Browse versions', platform: 'For Windows · Free · Project on GitHub', releaseLabel: 'LATEST RELEASE', releaseNotes: 'Release history', featuresEyebrow: 'MADE FOR YOUR GAME LIBRARY', featuresTitle: 'Find what you want<br />to play, faster', featureSearch: 'Search by name', featureSearchBody: 'Find Roblox experiences by name or Place ID, then launch them from the app.', searchPlaceholder: 'Try Blox Fruits', featureLibrary: 'Your own library', featureLibraryBody: 'Save favorites and return to your recently played experiences.', featureLaunch: 'One quick launch', featureLaunchBody: 'Open a place through the Roblox deep link without extra steps.', launchLabel: 'PLAY NOW', versionsEyebrow: 'UPDATES AND DOWNLOADS', versionsTitle: 'Launcher versions', versionsBody: 'Download the latest build or browse earlier releases.', allGithub: 'All releases on GitHub', loading: 'Loading versions…', updatesNote: 'The launcher checks for new versions at startup and downloads updates automatically.', footer: 'Made to help you find games and return to the worlds you love.', noReleases: 'No published versions yet', noReleasesBody: 'When the first GitHub Release is published, its versions and installers will appear here.', apiError: 'Could not load the version list', apiErrorBody: 'Open the releases page on GitHub or try again later.', version: 'Version', latest: 'LATEST', prerelease: 'BETA', stable: 'RELEASE', download: 'Download installer', checksum: 'SHA-256', noInstaller: 'Installer has not been uploaded', noNotes: 'No release notes were added.', downloaded: 'downloads', published: 'Published', latestAvailable: 'Latest version', releaseFallback: 'Open release on GitHub'
  }
};

let language = localStorage.getItem('vortex.siteLanguage') || (navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en');
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
  document.title = language === 'ru' ? 'Vortex — лаунчер плейсов' : 'Vortex — Place Launcher';
  document.documentElement.dataset.language = language;
  if (window.releaseList) renderReleases(window.releaseList);
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

function releaseDate(release) {
  const date = release.published_at ? new Date(release.published_at) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function releaseAssets(release) {
  const version = releaseVersion(release);
  const installerName = `Vortex Launcher Setup ${version}.exe`;
  const assets = Array.isArray(release.assets) ? release.assets : [];
  return {
    installer: assets.find((asset) => asset.name === installerName && /^https:\/\/github\.com\//i.test(asset.browser_download_url || '')),
    checksum: assets.find((asset) => asset.name === `${installerName}.sha256` && /^https:\/\/github\.com\//i.test(asset.browser_download_url || ''))
  };
}

function setLatestRelease(release) {
  const versionNode = document.getElementById('latest-version');
  const dateNode = document.getElementById('latest-date');
  const link = document.getElementById('latest-release-link');
  const download = document.getElementById('hero-download');
  if (!release) {
    versionNode.textContent = t('noReleases');
    dateNode.textContent = '';
    link.href = `https://github.com/${repository}/releases`;
    download.href = '#versions';
    download.setAttribute('aria-disabled', 'true');
    return;
  }
  const version = releaseVersion(release);
  const { installer } = releaseAssets(release);
  versionNode.textContent = `v${version}`;
  dateNode.textContent = releaseDate(release);
  link.href = release.html_url;
  download.href = installer ? installer.browser_download_url : release.html_url;
  download.setAttribute('aria-disabled', installer ? 'false' : 'true');
  download.title = installer ? t('download') : t('noInstaller');
}

function renderReleases(releases) {
  const container = document.getElementById('versions-list');
  container.replaceChildren();
  if (!releases.length) {
    const empty = createText('div', 'empty-state', '');
    const inner = document.createElement('span');
    inner.innerHTML = `<strong>${escapeHtml(t('noReleases'))}</strong><br />${escapeHtml(t('noReleasesBody'))}`;
    empty.appendChild(inner);
    container.appendChild(empty);
    setLatestRelease(null);
    return;
  }

  const latestStable = releases.find((release) => !release.prerelease) || releases[0];
  setLatestRelease(latestStable);
  const shown = releases.slice(0, 20);
  shown.forEach((release, index) => {
    const { installer, checksum } = releaseAssets(release);
    const version = releaseVersion(release);
    const card = document.createElement('article');
    card.className = 'version-card';
    const meta = document.createElement('div');
    meta.className = 'version-meta';
    const badge = createText('span', `version-badge${release.prerelease ? ' prerelease' : ''}`, `v${version}`);
    meta.appendChild(badge);
    meta.appendChild(createText('span', 'version-date', releaseDate(release)));
    const notes = createText('p', 'version-notes', String(release.body || '').trim().slice(0, 1400) || t('noNotes'));
    const actions = document.createElement('div');
    actions.className = 'version-actions';
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
    if (index === 0 && !release.prerelease) badge.title = t('latestAvailable');
    card.append(meta, notes, actions);
    container.appendChild(card);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function loadReleases() {
  const versionNode = document.getElementById('latest-version');
  try {
    const response = await fetch(releasesApi, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const releases = await response.json();
    if (!Array.isArray(releases)) throw new Error('Unexpected release list');
    window.releaseList = releases.filter((release) => !release.draft);
    renderReleases(window.releaseList);
  } catch (error) {
    console.warn('Could not load Vortex releases:', error);
    versionNode.textContent = t('apiError');
    document.getElementById('latest-date').textContent = '';
    document.getElementById('hero-download').setAttribute('aria-disabled', 'true');
    const container = document.getElementById('versions-list');
    const empty = createText('div', 'empty-state', '');
    const inner = document.createElement('span');
    inner.innerHTML = `<strong>${escapeHtml(t('apiError'))}</strong><br />${escapeHtml(t('apiErrorBody'))}`;
    empty.appendChild(inner);
    container.replaceChildren(empty);
  }
}

document.getElementById('year').textContent = new Date().getFullYear();
applyLanguage();
loadReleases();
