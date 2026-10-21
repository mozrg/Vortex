const repository = 'mozrg/Vortex';
const releasesApi = `https://api.github.com/repos/${repository}/releases?per_page=30`;

const copy = {
  ru: {
    navFeatures: 'Возможности', navVersions: 'Версии', eyebrow: 'ТВОЯ СЛЕДУЮЩАЯ ИГРА — БЛИЖЕ', heroTitle: 'Vortex', heroBody: 'Vortex собирает плейсы Roblox в одном удобном лаунчере: поиск по названию, избранное и быстрый запуск.', downloadLatest: 'Скачать последнюю версию', seeVersions: 'Посмотреть версии', platform: 'Для Windows · Бесплатно · Проект на GitHub', releaseLabel: 'ПОСЛЕДНИЙ РЕЛИЗ', releaseNotes: 'История релизов', featuresEyebrow: 'ДЛЯ ТВОЕЙ ИГРОВОЙ ПОЛКИ', featuresTitle: 'Быстрее находи то,<br />во что хочется играть', featureSearch: 'Поиск по названию', featureSearchBody: 'Находи плейсы Roblox по имени или Place ID и переходи к запуску прямо из лаунчера.', searchPlaceholder: 'Например, Blox Fruits', featureLibrary: 'Своя библиотека', featureLibraryBody: 'Сохраняй любимые игры и возвращайся к недавним запускам.', featureLaunch: 'Один быстрый запуск', featureLaunchBody: 'Открой плейс через Roblox deep link, не теряя время на лишние шаги.', launchLabel: 'ЗАПУСТИТЬ', versionsEyebrow: 'ОБНОВЛЕНИЯ И ФАЙЛЫ', versionsTitle: 'Версии лаунчера', versionsBody: 'Скачивай последнюю сборку или найди предыдущие релизы.', allGithub: 'Все релизы на GitHub', releasesWord: 'релизов', loading: 'Загружаем версии…', updatesNote: 'Лаунчер проверяет новые версии при запуске и загружает обновление автоматически.', footer: 'Сделано, чтобы быстрее находить игры и возвращаться в любимые миры.', noReleases: 'Пока нет опубликованных версий', noReleasesBody: 'Когда появится первый GitHub Release, здесь будут версии и ссылки на установщики.', apiError: 'Не удалось загрузить список версий', apiErrorBody: 'Открой страницу релизов на GitHub или попробуй позже.', version: 'Версия', latest: 'ПОСЛЕДНЯЯ', prerelease: 'БЕТА', stable: 'РЕЛИЗ', download: 'Скачать установщик', checksum: 'SHA-256', noInstaller: 'Установщик пока не загружен', noNotes: 'Описание этого релиза не добавлено.', downloaded: 'загрузок', published: 'Опубликовано', latestAvailable: 'Последняя версия', releaseFallback: 'Открыть релиз на GitHub', showAllNotes: 'Показать все изменения', showLessNotes: 'Свернуть'
  },
  en: {
    navFeatures: 'Features', navVersions: 'Versions', eyebrow: 'YOUR NEXT GAME IS CLOSER', heroTitle: 'Vortex', heroBody: 'Vortex brings Roblox experiences into one launcher: search by name, save favorites, and launch fast.', downloadLatest: 'Download the latest version', seeVersions: 'Browse versions', platform: 'For Windows · Free · Project on GitHub', releaseLabel: 'LATEST RELEASE', releaseNotes: 'Release history', featuresEyebrow: 'MADE FOR YOUR GAME LIBRARY', featuresTitle: 'Find what you want<br />to play, faster', featureSearch: 'Search by name', featureSearchBody: 'Find Roblox experiences by name or Place ID, then launch them from the app.', searchPlaceholder: 'Try Blox Fruits', featureLibrary: 'Your own library', featureLibraryBody: 'Save favorites and return to your recently played experiences.', featureLaunch: 'One quick launch', featureLaunchBody: 'Open a place through the Roblox deep link without extra steps.', launchLabel: 'PLAY NOW', versionsEyebrow: 'UPDATES AND DOWNLOADS', versionsTitle: 'Launcher versions', versionsBody: 'Download the latest build or browse earlier releases.', allGithub: 'All releases on GitHub', releasesWord: 'releases', loading: 'Loading versions…', updatesNote: 'The launcher checks for new versions at startup and downloads updates automatically.', footer: 'Made to help you find games and return to the worlds you love.', noReleases: 'No published versions yet', noReleasesBody: 'When the first GitHub Release is published, its versions and installers will appear here.', apiError: 'Could not load the version list', apiErrorBody: 'Open the releases page on GitHub or try again later.', version: 'Version', latest: 'LATEST', prerelease: 'BETA', stable: 'RELEASE', download: 'Download installer', checksum: 'SHA-256', noInstaller: 'Installer has not been uploaded', noNotes: 'No release notes were added.', downloaded: 'downloads', published: 'Published', latestAvailable: 'Latest version', releaseFallback: 'Open release on GitHub', showAllNotes: 'Show all changes', showLessNotes: 'Collapse'
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
  const assets = Array.isArray(release.assets) ? release.assets : [];
  // The installer name has shipped under both "Vortex Launcher Setup x.exe"
  // and "Vortex-Launcher-Setup-x.exe": match any spacing variant.
  const isInstaller = (name) => new RegExp(`^Vortex[.\s-]*Launcher[.\s-]*Setup[.\s-]*${version.replace(/\./g, '\\.')}(\\.exe)?$`, 'i').test(String(name));
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
  const { installer, checksum } = releaseAssets(release);
  versionNode.textContent = `v${version}`;
  dateNode.textContent = releaseDate(release);
  link.href = release.html_url;
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

// ---- Release notes markdown -------------------------------------------------
// GitHub release bodies are markdown. Rendering them as plain text turned
// "- item" lists into one run-on paragraph, so notes are parsed into real
// DOM nodes here. Everything is built with textContent/createElement: the
// body never reaches innerHTML, so no HTML from the API can execute.

const SAFE_LINK = /^https?:\/\//i;

// Inline spans: **bold**, *italic*, `code`, [label](url).
function appendInline(parent, text) {
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parent.appendChild(document.createTextNode(text.slice(last, match.index)));
    const token = match[0];
    if (token.startsWith('**') || token.startsWith('__')) {
      const strong = document.createElement('strong');
      strong.textContent = token.slice(2, -2);
      parent.appendChild(strong);
    } else if (token.startsWith('`')) {
      const code = document.createElement('code');
      code.textContent = token.slice(1, -1);
      parent.appendChild(code);
    } else if (token.startsWith('[')) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      if (link && SAFE_LINK.test(link[2])) {
        const anchor = document.createElement('a');
        anchor.href = link[2];
        anchor.target = '_blank';
        anchor.rel = 'noreferrer';
        anchor.textContent = link[1];
        parent.appendChild(anchor);
      } else {
        parent.appendChild(document.createTextNode(link ? link[1] : token));
      }
    } else {
      const em = document.createElement('em');
      em.textContent = token.slice(1, -1);
      parent.appendChild(em);
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
}

// Block markdown: headings, bullet/ordered lists (nested by indent), task
// lists, blockquotes, horizontal rules and paragraphs.
function renderReleaseNotes(markdown) {
  const fragment = document.createDocumentFragment();
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const stack = []; // open lists: { indent, node }
  let paragraph = null;

  const closeLists = (minIndent = -1) => {
    while (stack.length && stack[stack.length - 1].indent > minIndent) stack.pop();
  };
  const closeParagraph = () => { if (paragraph) { fragment.appendChild(paragraph); paragraph = null; } };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { closeLists(); closeParagraph(); continue; }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      closeLists(); closeParagraph();
      const level = Math.min(4, heading[1].length + 2);
      const node = document.createElement(`h${level}`);
      appendInline(node, heading[2].trim());
      fragment.appendChild(node);
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      closeLists(); closeParagraph();
      fragment.appendChild(document.createElement('hr'));
      continue;
    }

    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      closeLists(); closeParagraph();
      const node = document.createElement('blockquote');
      appendInline(node, quote[1]);
      fragment.appendChild(node);
      continue;
    }

    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    const ordered = /^(\s*)\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || ordered) {
      closeParagraph();
      const indent = (bullet ? bullet[1] : ordered[1]).length;
      const tag = bullet ? 'ul' : 'ol';
      let text = bullet ? bullet[2] : ordered[2];

      // One list stays open per indent level. Deeper lines nest inside the
      // item that introduced them; shallower lines close the inner levels.
      while (stack.length && stack[stack.length - 1].indent > indent) stack.pop();

      let level = stack[stack.length - 1];
      if (!level || level.indent < indent) {
        const list = document.createElement(tag);
        if (level) level.node.lastElementChild.appendChild(list);
        else fragment.appendChild(list);
        level = { indent, node: list, tag };
        stack.push(level);
      } else if (level.tag !== tag) {
        // Same indent but a different marker style starts a sibling list.
        const list = document.createElement(tag);
        level.node.after(list);
        level = { indent, node: list, tag };
        stack[stack.length - 1] = level;
      }

      const item = document.createElement('li');
      const task = /^\[( |x|X)\]\s+(.*)$/.exec(text);
      if (task) {
        item.className = task[1].toLowerCase() === 'x' ? 'task done' : 'task';
        text = task[2];
      }
      appendInline(item, text);
      level.node.appendChild(item);
      continue;
    }

    closeLists();
    if (paragraph) paragraph.appendChild(document.createTextNode(' '));
    else paragraph = document.createElement('p');
    appendInline(paragraph, line.trim());
  }
  closeLists(); closeParagraph();
  return fragment;
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

    // Header row: version, date and actions stay on one line, notes get the
    // full width underneath so bullet lists read like a changelog.
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

    // Release body: real markdown rendering. clampNotes() decides afterwards
    // whether the body is long enough to need the "show all" toggle.
    const notes = document.createElement('div');
    notes.className = 'version-notes';
    const body = String(release.body || '').trim();
    if (body) notes.appendChild(renderReleaseNotes(body));
    else notes.appendChild(createText('p', 'version-notes-empty', t('noNotes')));

    card.append(head, notes);
    container.appendChild(card);
    clampNotes(notes);
  });
}

// Notes collapse to a few entries; the toggle appears only when there is more
// to read. The cut is placed on the text-line grid, so a bullet is never
// sliced halfway through a line of text.
const NOTES_VISIBLE_ENTRIES = 4;

function clampNotes(notes) {
  // One "entry" is a top-level block: a list item, a paragraph, a heading.
  const entries = [];
  for (const child of notes.children) {
    const tag = child.tagName;
    if (tag === 'UL' || tag === 'OL') entries.push(...Array.from(child.children));
    else entries.push(child);
  }
  if (entries.length <= NOTES_VISIBLE_ENTRIES) return;

  // Measure after layout: the card was just inserted, so geometry is still 0
  // until the browser has laid the notes out.
  requestAnimationFrame(() => {
    const notesTop = notes.getBoundingClientRect().top;
    const fullHeight = notes.getBoundingClientRect().height;
    const limit = entries[NOTES_VISIBLE_ENTRIES - 1];
    const cut = Math.ceil(limit.getBoundingClientRect().bottom - notesTop);
    const lineHeight = parseFloat(getComputedStyle(notes).lineHeight) || 17;
    // Snap to whole lines, then keep one extra line of context.
    const height = (Math.ceil(cut / lineHeight) + 1) * lineHeight;

    // Only clamp when the notes genuinely overflow; short bodies stay untouched.
    if (fullHeight <= height + 2) return;

    notes.style.setProperty('--notes-limit', `${height}px`);
    notes.classList.add('is-clamped');

    const toggle = createText('button', 'notes-toggle', t('showAllNotes'));
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      const clamped = notes.classList.toggle('is-clamped');
      toggle.textContent = clamped ? t('showAllNotes') : t('showLessNotes');
      toggle.setAttribute('aria-expanded', String(!clamped));
    });
    notes.after(toggle);
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
