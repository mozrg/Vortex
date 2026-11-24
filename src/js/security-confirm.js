// Security verification, confirmation dialogs, and folder share codes (VORTEXFD1).

const securityLabels = [
  ['settings.safety.title', 'Подтверждения и безопасность', 'Confirmations & security'],
  ['settings.safety.body', 'Защита от случайного запуска игр и удаления сохранённых элементов.', 'Guard against accidental game launches and deletions.'],
  ['settings.safety.confirmLaunch', 'Подтверждение на запуск', 'Confirm before launching'],
  ['settings.safety.confirmLaunchHint', 'Показывать окно подтверждения с названием игры и автором перед запуском Roblox.', 'Show a confirmation prompt with game title and creator before launching Roblox.'],
  ['settings.safety.confirmDelete', 'Подтверждение на удаление', 'Confirm before deleting'],
  ['settings.safety.confirmDeleteHint', 'Спрашивать подтверждение перед удалением игр, папок быстрого запуска и профилей.', 'Ask for confirmation before deleting quick launch items, folders, or profiles.'],
  ['confirm.launchTitle', 'Запустить игру?', 'Launch this game?'],
  ['confirm.launchBody', 'Вы действительно хотите открыть {title} в Roblox?', 'Do you want to launch {title} in Roblox?'],
  ['confirm.launchAction', 'Запустить', 'Launch'],
  ['confirm.deleteTitle', 'Удалить элемент?', 'Delete item?'],
  ['confirm.deleteBody', 'Удалить «{title}»? Это действие нельзя отменить.', 'Delete "{title}"? This action cannot be undone.'],
  ['confirm.deleteAction', 'Удалить', 'Delete'],
  ['security.domainSafe', 'Официальный домен roblox.com', 'Official roblox.com domain'],
  ['security.domainSpoofed', 'Подозрительная ссылка: «{host}» — это НЕ настоящий roblox.com!', 'Suspicious link: "{host}" is NOT the real roblox.com!'],
  ['security.domainHomograph', 'Подделка домена (похожие символы в адресе «{host}»)!', 'Spoofed domain (lookalike characters in "{host}")!'],
  ['security.authorLabel', 'Автор', 'Creator'],
  ['security.authorUnknown', 'Автор не указан', 'Unknown creator'],
  ['security.checkingPack', 'Проверяем игры и авторов в подборке…', 'Verifying games and creators in this pack…'],
  ['security.packVerified', 'Проверено: официальные Place ID Roblox', 'Verified: official Roblox Place IDs'],
  ['security.packWarning', 'Внимание: в файле обнаружены подозрительные или некорректные ссылки!', 'Warning: suspicious or invalid links were found in this file!'],
  ['tools.copyFolderCode', 'Скопировать код папки', 'Copy folder code'],
  ['tools.folderCodeCopied', 'Код папки скопирован в буфер обмена', 'Folder code copied to clipboard'],
  ['tools.folderCodeTooLarge', 'Папка слишком большая для кода — сохраните её в файл.', 'Folder is too large for a share code — save it as a file instead.']
];
for (const [key, ru, en] of securityLabels) {
  translations.ru[key] = ru;
  translations.en[key] = en;
}

const AUTHENTIC_ROBLOX_HOSTS = new Set([
  'roblox.com',
  'www.roblox.com',
  'web.roblox.com',
  'ro.blox.com'
]);

/**
 * Inspect a user-supplied URL or string for spoofed / lookalike Roblox domains.
 * Detects Punycode (`xn--`), non-ASCII homoglyphs (e.g. Cyrillic 'о'/'а'), and
 * non-official domains masquerading as roblox.com.
 */
function inspectRobloxLinkSafety(rawInput) {
  const text = String(rawInput || '').trim();
  if (!text) return { isUrl: false, authentic: true, host: '', reason: 'empty' };
  const looksLikeUrl = /^https?:\/\//i.test(text) || /^[a-z0-9\u0400-\u04ff.-]+\.[a-z\u0400-\u04ff]{2,}(\/|$)/i.test(text);
  if (!looksLikeUrl) return { isUrl: false, authentic: true, host: '', reason: 'not-url' };

  const normalized = /^https?:\/\//i.test(text) ? text : 'https://' + text;
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return { isUrl: true, authentic: false, host: text.slice(0, 60), reason: 'invalid-url' };
  }
  const host = (parsed.hostname || '').toLowerCase();
  const hasNonAscii = /[^\x00-\x7f]/.test(text.split('/')[2] || '');
  const isPunycode = host.split('.').some(label => label.startsWith('xn--'));
  if (hasNonAscii || isPunycode) {
    return { isUrl: true, authentic: false, host, reason: 'homograph' };
  }
  if (AUTHENTIC_ROBLOX_HOSTS.has(host)) {
    return { isUrl: true, authentic: true, host, reason: 'authentic' };
  }
  return { isUrl: true, authentic: false, host, reason: 'spoofed-domain' };
}

/**
 * Promise-based native Vortex confirmation dialog.
 */
function confirmVortexAction({
  title,
  body = '',
  confirmText = t('common.confirm') !== 'common.confirm' ? t('common.confirm') : 'OK',
  cancelText = t('common.cancel'),
  danger = false,
  metaHtml = ''
}) {
  return new Promise((resolve) => {
    const existing = document.getElementById('vortex-confirm-modal');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'vortex-confirm-modal';
    backdrop.className = 'vip-config-backdrop';
    backdrop.innerHTML = `<div class="vip-config-dialog vortex-confirm-dialog" role="alertdialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <header class="vip-config-header">
        <h2>${icon(danger ? 'alert' : 'shield', 16)} ${escapeHtml(title)}</h2>
        <button type="button" class="icon-button" data-confirm-choice="cancel" aria-label="${escapeHtml(cancelText)}">${icon('close', 16)}</button>
      </header>
      <div class="vip-config-body">
        ${body ? `<p class="vortex-confirm-body">${escapeHtml(body)}</p>` : ''}
        ${metaHtml}
        <div class="vip-config-footer">
          <span></span>
          <div class="vip-create-actions">
            <button type="button" class="ghost-button" data-confirm-choice="cancel">${escapeHtml(cancelText)}</button>
            <button type="button" class="${danger ? 'danger-button' : 'primary-button'}" data-confirm-choice="confirm">${escapeHtml(confirmText)}</button>
          </div>
        </div>
      </div>
    </div>`;

    const finish = (answer) => {
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      resolve(answer);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
      }
    };
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) { finish(false); return; }
      const btn = event.target.closest?.('[data-confirm-choice]');
      if (!btn) return;
      finish(btn.dataset.confirmChoice === 'confirm');
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-confirm-choice="confirm"]')?.focus();
  });
}

async function resolveGameSecurityMeta(placeId) {
  const id = String(placeId || '').trim();
  if (!/^\d{1,20}$/.test(id)) return null;
  const known = typeof getGame === 'function' ? getGame(id) : null;
  if (known?.creator) {
    return {
      id,
      title: known.title || 'Roblox #' + id,
      creator: known.creator,
      creatorVerified: Boolean(known.creatorVerified),
      thumbnail: safeThumbnail(known.thumbnail)
    };
  }
  try {
    const details = await window.vortexDesktop?.getGameDetails?.({ placeId: id });
    if (details) {
      return {
        id,
        title: details.title || known?.title || 'Roblox #' + id,
        creator: details.creator || '',
        creatorVerified: Boolean(details.creatorVerified),
        thumbnail: safeThumbnail(details.thumbnail || known?.thumbnail)
      };
    }
  } catch { /* fallback to local */ }
  return {
    id,
    title: known?.title || 'Roblox #' + id,
    creator: known?.creator || '',
    creatorVerified: Boolean(known?.creatorVerified),
    thumbnail: safeThumbnail(known?.thumbnail)
  };
}

function renderSecurityMetaCard(meta, linkCheck = null) {
  const thumb = meta?.thumbnail ? `<img src="${escapeHtml(meta.thumbnail)}" alt="">` : icon('gamepad', 18);
  const creator = meta?.creator ? escapeHtml(meta.creator) : t('security.authorUnknown');
  const verified = meta?.creatorVerified ? ` <span class="security-verified-mark" aria-label="Verified">✓</span>` : '';
  let badge = '';
  if (linkCheck && linkCheck.isUrl) {
    badge = linkCheck.authentic
      ? `<div class="security-domain-pill is-safe">${icon('check', 13)} ${t('security.domainSafe')}</div>`
      : `<div class="security-domain-pill is-danger">${icon('alert', 13)} ${t(linkCheck.reason === 'homograph' ? 'security.domainHomograph' : 'security.domainSpoofed', { host: escapeHtml(linkCheck.host) })}</div>`;
  }
  return `<div class="security-verify-card">
    <div class="security-verify-row">
      <span class="security-verify-thumb">${thumb}</span>
      <div class="security-verify-copy">
        <strong>${escapeHtml(meta?.title || 'Roblox')}</strong>
        <small>${t('security.authorLabel')}: ${creator}${verified}</small>
      </div>
    </div>
    ${badge}
  </div>`;
}

/**
 * Encode an entire Quick Launch folder into a shareable VORTEXFD1-... code.
 */
function encodeQuickFolderCode(folder) {
  if (!folder || folder.type !== 'folder') return '';
  const entries = (Array.isArray(folder.games) ? folder.games : []).slice(0, 40).map(
    ({ method, placeId, title, thumbnail, linkCode, shareCode, shareType, serverId, accessCode }) => ({
      method,
      placeId: placeId || '',
      title: String(title || '').slice(0, 64),
      thumbnail: thumbnail || '',
      linkCode: linkCode || '',
      shareCode: shareCode || '',
      shareType: shareType || 'Server',
      serverId: serverId || '',
      accessCode: accessCode || ''
    })
  );
  const payload = {
    app: 'vortex-quick-folder',
    version: 1,
    title: String(folder.title || '').slice(0, 48),
    color: folder.color || '',
    server: folder.server || 'default',
    showInTray: Boolean(folder.showInTray),
    games: entries
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = 'VORTEXFD1-' + btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return encoded.length <= 24000 ? encoded : '';
}

function decodeQuickFolderCode(raw) {
  const trimmed = String(raw || '').trim();
  if (!/^VORTEXFD1-/i.test(trimmed)) return null;
  const code = trimmed.replace(/^VORTEXFD1-/i, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!code || code.length > 24000) return null;
  try {
    const binary = atob(code + '='.repeat((4 - code.length % 4) % 4));
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0))));
    if (payload?.app !== 'vortex-quick-folder' || payload?.version !== 1 || !Array.isArray(payload.games)) return null;
    return payload;
  } catch {
    return null;
  }
}

const THEME_SHARE_KEYS = [
  'theme', 'accent', 'accentSecondary', 'accentMode', 'gradientAngle',
  'themeBackground', 'themeSurface', 'themeText', 'themeMuted', 'themeLine',
  'corners', 'density', 'cardRadius', 'customCardRadius', 'glow', 'glassStrength', 'uiFont'
];

function encodeThemeCode(prefs) {
  if (!prefs || typeof prefs !== 'object') return '';
  const data = {};
  for (const key of THEME_SHARE_KEYS) {
    if (prefs[key] !== undefined && prefs[key] !== '') data[key] = prefs[key];
  }
  const payload = { app: 'vortex-theme', version: 1, data };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return 'VORTEXTH1-' + btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodeThemeCode(raw) {
  const trimmed = String(raw || '').trim();
  if (!/^VORTEXTH1-/i.test(trimmed)) return null;
  const code = trimmed.replace(/^VORTEXTH1-/i, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!code || code.length > 4096) return null;
  try {
    const binary = atob(code + '='.repeat((4 - code.length % 4) % 4));
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0))));
    if (payload?.app !== 'vortex-theme' || payload?.version !== 1 || !payload.data || typeof payload.data !== 'object') return null;
    const clean = {};
    for (const key of THEME_SHARE_KEYS) {
      if (Object.hasOwn(payload.data, key)) clean[key] = payload.data[key];
    }
    return Object.keys(clean).length ? clean : null;
  } catch {
    return null;
  }
}
