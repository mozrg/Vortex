// Static page: it calls api.github.com directly with the author's own token.
// Nothing here is secret — the token is entered at runtime and kept in
// sessionStorage by default (or localStorage only if explicitly opted in).
//
// Storage is a plain JSON file in the repository, served by GitHub Pages.
// Every publish is a commit, so the history and rollback come for free.
(() => {
  const API = 'https://api.github.com';
  const REPO = 'mozrg/Vortex';
  const BRANCH = 'main';
  const FILES = { notifications: 'site/notifications.json', plans: 'site/plans.json' };
  const STORE_TOKEN = 'vortex.notify.token';

  const $ = (id) => document.getElementById(id);
  let editingId = null;
  let editingPlanId = null;
  let activeTab = 'notifications';

  function loadStoredToken() {
    try {
      const session = sessionStorage.getItem(STORE_TOKEN);
      if (session) return { token: session, remembered: false };
    } catch { /* ignore */ }
    try {
      const local = localStorage.getItem(STORE_TOKEN);
      if (local) return { token: local, remembered: true };
    } catch { /* ignore */ }
    return { token: '', remembered: false };
  }

  function persistToken(token, remember) {
    try { sessionStorage.removeItem(STORE_TOKEN); } catch { /* ignore */ }
    try { localStorage.removeItem(STORE_TOKEN); } catch { /* ignore */ }
    if (!token) return;
    try {
      if (remember) localStorage.setItem(STORE_TOKEN, token);
      else sessionStorage.setItem(STORE_TOKEN, token);
    } catch { /* ignore */ }
  }

  const initialToken = loadStoredToken();
  const state = { token: initialToken.token, shas: {} };

  function setStatus(node, text, kind) {
    node.textContent = text;
    node.className = 'status' + (kind ? ' ' + kind : '');
  }

  // ---- GitHub ----------------------------------------------------------

  async function gh(pathname, options = {}) {
    const response = await fetch(API + pathname, {
      ...options,
      headers: {
        Authorization: 'Bearer ' + state.token,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {})
      }
    });
    if (response.status === 401) throw new Error('Токен неверный или отозван (401).');
    if (response.status === 403) throw new Error('Нет прав на запись (403). Нужен доступ Contents: Read and write.');
    if (response.status === 409) throw new Error('Конфликт версий (409). Нажмите «Обновить» и повторите.');
    if (response.status === 404) throw new Error('Файл или репозиторий не найден (404). Проверьте права токена.');
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error('GitHub ' + response.status + (text ? ': ' + text.slice(0, 160) : ''));
    }
    return response.json();
  }

  function bytesToBase64(text) {
    // btoa is latin1-only; encode UTF-8 first so Cyrillic survives.
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function base64ToText(value) {
    const binary = atob(String(value || '').replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  // Returns { items, sha, missing }. sha is required for the next write.
  async function readDoc(file = FILES[activeTab]) {
    const response = await fetch(
      API + '/repos/' + REPO + '/contents/' + file + '?ref=' + BRANCH + '&t=' + Date.now(),
      {
        headers: {
          Authorization: 'Bearer ' + state.token,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        cache: 'no-store'
      }
    );
    if (response.status === 404) { state.shas[file] = null; return { items: [], sha: null, missing: true }; }
    if (response.status === 401) throw new Error('Токен неверный или отозван (401).');
    if (!response.ok) throw new Error('GitHub ' + response.status);
    const data = await response.json();
    state.shas[file] = data.sha;
    try {
      const parsed = JSON.parse(base64ToText(data.content));
      const items = Array.isArray(parsed) ? parsed : parsed.items;
      return { items: Array.isArray(items) ? items : [], sha: data.sha };
    } catch {
      throw new Error('В файле битый JSON — исправьте ' + file + ' в репозитории.');
    }
  }

  async function writeDoc(file, items, sha, message) {
    const content = JSON.stringify({ version: 1, items }, null, 2) + '\n';
    const body = { message, content: bytesToBase64(content), branch: BRANCH };
    if (sha) body.sha = sha;
    const result = await gh('/repos/' + REPO + '/contents/' + file, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    state.shas[file] = result?.content?.sha || null;
  }

  // ---- Rendering -------------------------------------------------------

  function renderList(items) {
    const list = $('list');
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Пока ничего не опубликовано.';
      list.appendChild(empty);
      return;
    }
    const sorted = [...items].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    for (const item of sorted) {
      const row = document.createElement('div');
      row.className = 'item';

      const head = document.createElement('div');
      head.className = 'item-head';
      const title = document.createElement('span');
      title.className = 'item-title';
      title.textContent = item.title || '(без заголовка)';
      const tag = document.createElement('span');
      tag.className = 'tag ' + (['info', 'success', 'warning'].includes(item.level) ? item.level : 'info');
      tag.textContent = item.level || 'info';
      head.append(title, tag);

      const body = document.createElement('div');
      body.className = 'item-body markdown-body';
      window.VortexMarkdown?.render(body, item.body || '');

      const meta = document.createElement('div');
      meta.className = 'item-meta';
      meta.textContent = [
        item.id,
        item.date ? new Date(item.date).toLocaleString('ru-RU') : '',
        item.minVersion ? 'от ' + item.minVersion : ''
      ].filter(Boolean).join(' · ');

      const actions = document.createElement('div');
      actions.className = 'item-actions';
      const edit = document.createElement('button');
      edit.className = 'tiny';
      edit.textContent = 'Изменить';
      edit.addEventListener('click', () => startEdit(item));
      const remove = document.createElement('button');
      remove.className = 'tiny danger';
      remove.textContent = 'Удалить';
      remove.addEventListener('click', () => removeItem(item));
      actions.append(edit, remove);
      if (item.updateLog?.trim() || item.releaseTag
        || /^(?:Vortex\s+)?v?\d+\.\d+\.\d+(?:[-+][\da-z.+-]+)?$/i.test(item.title || '')
        || /^https:\/\/github\.com\/mozrg\/Vortex\/releases\/tag\//i.test(item.url || '')) {
        const logLink = document.createElement('a');
        logLink.href = './updates.html?' + new URLSearchParams({ notice: item.id });
        logLink.target = '_blank';
        logLink.rel = 'noopener noreferrer';
        logLink.textContent = 'Открыть лог ↗';
        actions.prepend(logLink);
      }

      row.append(head, body, meta, actions);
      list.appendChild(row);
    }
  }

  // ---- Editor ----------------------------------------------------------

  function newId(title) {
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'note';
    return new Date().toISOString().slice(0, 10) + '-' + slug;
  }

  function readForm() {
    const title = $('title').value.trim();
    const body = $('body').value.trim();
    if (!title) throw new Error('Заголовок обязателен.');
    const minVersion = $('min-version').value.trim();
    if (minVersion && !/^\d+\.\d+\.\d+$/.test(minVersion)) throw new Error('Мин. версия в формате 1.2.3.');
    const url = $('url').value.trim();
    if (url && !/^https?:\/\//i.test(url)) throw new Error('Ссылка должна начинаться с http:// или https://');
    const releaseTag = $('release-tag').value.trim();
    if (releaseTag && !/^v?\d+\.\d+\.\d+(?:[-+][\da-z.+-]+)?$/i.test(releaseTag)) {
      throw new Error('Укажи тег релиза, например 1.2.6 или v1.2.6.');
    }
    const updateLog = $('update-log').value;
    return {
      id: editingId || newId(title),
      title,
      body,
      level: $('level').value,
      minVersion: minVersion || undefined,
      url: url || undefined,
      releaseTag: releaseTag || undefined,
      updateLog: updateLog.trim() ? updateLog : undefined
    };
  }

  function startEdit(item) {
    editingId = item.id;
    $('editor-title').textContent = 'Изменение уведомления';
    $('title').value = item.title || '';
    $('body').value = item.body || '';
    $('level').value = item.level || 'info';
    $('min-version').value = item.minVersion || '';
    $('url').value = item.url || '';
    $('release-tag').value = item.releaseTag || '';
    $('update-log').value = item.updateLog || '';
    $('release-log-field').open = Boolean(item.releaseTag || item.updateLog);
    $('cancel-edit').classList.remove('hidden');
    updatePreview();
    $('title').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetEditor() {
    editingId = null;
    $('editor-title').textContent = 'Новое уведомление';
    $('title').value = '';
    $('body').value = '';
    $('level').value = 'info';
    $('min-version').value = '';
    $('url').value = '';
    $('release-tag').value = '';
    $('update-log').value = '';
    $('release-log-field').open = false;
    $('cancel-edit').classList.add('hidden');
    updatePreview();
  }

  function updatePreview() {
    $('preview-title').textContent = $('title').value.trim() || 'Заголовок появится здесь';
    const body = $('body').value;
    window.VortexMarkdown?.render($('preview-body'), body.trim() ? body : 'И текст уведомления.', { headingOffset: 2 });
    const log = $('update-log').value;
    $('log-preview').classList.toggle('hidden', !log.trim());
    window.VortexMarkdown?.render($('preview-log-body'), log, { headingOffset: 1 });
  }

  // ---- Actions ---------------------------------------------------------

  async function refresh() {
    setStatus($('status'), 'Загружаем…');
    try {
      const doc = await readDoc(FILES.notifications);
      renderList(doc.items);
      setStatus($('status'), doc.missing ? 'Файла ещё нет — он создастся при публикации.' : 'Загружено: ' + doc.items.length, doc.missing ? '' : 'ok');
    } catch (error) {
      setStatus($('status'), error.message, 'err');
    }
  }

  async function publish() {
    let draft;
    try { draft = readForm(); } catch (error) { setStatus($('status'), error.message, 'err'); return; }
    $('publish').disabled = true;
    setStatus($('status'), 'Публикуем…');
    try {
      const doc = await readDoc(FILES.notifications);
      const index = doc.items.findIndex((item) => item.id === draft.id);
      const isEdit = index >= 0;
      if (isEdit) {
        // Keep the original date when editing so ordering stays stable.
        draft.date = doc.items[index].date || new Date().toISOString();
        doc.items[index] = draft;
      } else {
        draft.date = new Date().toISOString();
        doc.items.push(draft);
      }
      await writeDoc(FILES.notifications, doc.items, doc.sha, `notifications: ${isEdit ? 'edit' : 'add'} ${draft.title}`);
      renderList(doc.items);
      resetEditor();
      setStatus($('status'), 'Опубликовано. Pages обновится за ~1 минуту, лаунчер — в течение 5.', 'ok');
    } catch (error) {
      setStatus($('status'), error.message, 'err');
    } finally {
      $('publish').disabled = false;
    }
  }

  async function removeItem(item) {
    if (!confirm('Удалить «' + (item.title || item.id) + '»? Уведомление исчезнет у всех.')) return;
    setStatus($('status'), 'Удаляем…');
    try {
      const doc = await readDoc(FILES.notifications);
      const items = doc.items.filter((entry) => entry.id !== item.id);
      await writeDoc(FILES.notifications, items, doc.sha, `notifications: remove ${item.title || item.id}`);
      renderList(items);
      if (editingId === item.id) resetEditor();
      setStatus($('status'), 'Удалено.', 'ok');
    } catch (error) {
      setStatus($('status'), error.message, 'err');
    }
  }

  function localizedPlan(value, language) {
    if (value && typeof value === 'object') return String(value[language] || value.ru || value.en || '');
    return String(value || '');
  }

  function renderPlansList(items) {
    const list = $('plans-list');
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Планов пока нет.';
      list.appendChild(empty);
      return;
    }
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'item';
      const head = document.createElement('div');
      head.className = 'item-head';
      const title = document.createElement('span');
      title.className = 'item-title';
      title.textContent = localizedPlan(item.title, 'ru') || localizedPlan(item.title, 'en') || '(без названия)';
      const tag = document.createElement('span');
      tag.className = 'tag info';
      tag.textContent = item.stage || 'idea';
      head.append(title, tag);
      const body = document.createElement('div');
      body.className = 'item-body markdown-body';
      window.VortexMarkdown?.render(body, localizedPlan(item.body, 'ru'));
      const meta = document.createElement('div');
      meta.className = 'item-meta';
      meta.textContent = [item.id, item.icon || 'flag', localizedPlan(item.title, 'en')].filter(Boolean).join(' · ');
      const actions = document.createElement('div');
      actions.className = 'item-actions';
      const edit = document.createElement('button');
      edit.className = 'tiny';
      edit.textContent = 'Изменить';
      edit.addEventListener('click', () => startEditPlan(item));
      const remove = document.createElement('button');
      remove.className = 'tiny danger';
      remove.textContent = 'Удалить';
      remove.addEventListener('click', () => removePlan(item));
      actions.append(edit, remove);
      row.append(head, body, meta, actions);
      list.appendChild(row);
    }
  }

  function startEditPlan(item) {
    editingPlanId = String(item.id || '');
    $('plan-editor-title').textContent = 'Изменение плана';
    $('plan-id').value = editingPlanId;
    $('plan-id').disabled = true;
    $('plan-icon').value = item.icon || 'flag';
    $('plan-stage').value = ['research', 'design', 'dev', 'idea'].includes(item.stage) ? item.stage : 'idea';
    $('plan-title-ru').value = localizedPlan(item.title, 'ru');
    $('plan-title-en').value = localizedPlan(item.title, 'en');
    $('plan-body-ru').value = localizedPlan(item.body, 'ru');
    $('plan-body-en').value = localizedPlan(item.body, 'en');
    $('cancel-plan-edit').classList.remove('hidden');
    $('publish-plan').textContent = 'Сохранить план';
    $('plan-title-ru').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetPlanEditor() {
    editingPlanId = null;
    $('plan-editor-title').textContent = 'Новый план';
    $('plan-id').value = '';
    $('plan-id').disabled = false;
    $('plan-icon').value = 'flag';
    $('plan-stage').value = 'idea';
    $('plan-title-ru').value = '';
    $('plan-title-en').value = '';
    $('plan-body-ru').value = '';
    $('plan-body-en').value = '';
    $('cancel-plan-edit').classList.add('hidden');
    $('publish-plan').textContent = 'Опубликовать план';
  }

  function readPlanForm() {
    const ruTitle = $('plan-title-ru').value.trim();
    const enTitle = $('plan-title-en').value.trim();
    if (!ruTitle || !enTitle) throw new Error('Заполните названия на русском и английском.');
    const icon = $('plan-icon').value.trim() || 'flag';
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(icon)) throw new Error('Иконка должна быть коротким ключом без пробелов.');
    const id = editingPlanId || $('plan-id').value.trim() || `plan-${Date.now().toString(36)}`;
    if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(id)) throw new Error('ID: латинские буквы, цифры, дефис и подчёркивание.');
    return {
      id, icon, stage: $('plan-stage').value,
      title: { ru: ruTitle, en: enTitle },
      body: { ru: $('plan-body-ru').value.trim(), en: $('plan-body-en').value.trim() }
    };
  }

  async function refreshPlans() {
    setStatus($('plans-status'), 'Загружаем планы…');
    try {
      const doc = await readDoc(FILES.plans);
      renderPlansList(doc.items);
      setStatus($('plans-status'), doc.missing ? 'Файл планов ещё не найден.' : 'Загружено: ' + doc.items.length, doc.missing ? 'err' : 'ok');
    } catch (error) {
      setStatus($('plans-status'), error.message, 'err');
    }
  }

  async function publishPlan() {
    let draft;
    try { draft = readPlanForm(); } catch (error) { setStatus($('plans-status'), error.message, 'err'); return; }
    $('publish-plan').disabled = true;
    setStatus($('plans-status'), 'Сохраняем план…');
    try {
      const doc = await readDoc(FILES.plans);
      const index = editingPlanId ? doc.items.findIndex((item) => item.id === editingPlanId) : -1;
      const isEdit = index >= 0;
      if (doc.items.some((item) => item.id === draft.id && item.id !== editingPlanId)) throw new Error('План с таким ID уже существует.');
      if (isEdit) doc.items[index] = draft;
      else doc.items.push(draft);
      await writeDoc(FILES.plans, doc.items, doc.sha, `plans: ${isEdit ? 'edit' : 'add'} ${draft.id}`);
      renderPlansList(doc.items);
      resetPlanEditor();
      setStatus($('plans-status'), 'План опубликован. Приложение обновит список в течение пяти минут.', 'ok');
    } catch (error) {
      setStatus($('plans-status'), error.message, 'err');
    } finally {
      $('publish-plan').disabled = false;
    }
  }

  async function removePlan(item) {
    const title = localizedPlan(item.title, 'ru') || item.id;
    if (!confirm('Удалить план «' + title + '»? Он исчезнет из вкладки планов у пользователей.')) return;
    setStatus($('plans-status'), 'Удаляем план…');
    try {
      const doc = await readDoc(FILES.plans);
      const items = doc.items.filter((entry) => entry.id !== item.id);
      await writeDoc(FILES.plans, items, doc.sha, `plans: remove ${item.id}`);
      renderPlansList(items);
      if (editingPlanId === item.id) resetPlanEditor();
      setStatus($('plans-status'), 'План удалён.', 'ok');
    } catch (error) {
      setStatus($('plans-status'), error.message, 'err');
    }
  }

  function switchAdminTab(tab) {
    if (!['notifications', 'plans'].includes(tab)) return;
    activeTab = tab;
    $('notifications-panel').hidden = tab !== 'notifications';
    $('plans-panel').hidden = tab !== 'plans';
    $('admin-title').textContent = tab === 'plans' ? 'Планы приложения' : 'Публикация уведомлений';
    $('admin-subtitle').textContent = tab === 'plans'
      ? 'Добавляйте, изменяйте и удаляйте пункты, которые появятся во вкладке «Планы».'
      : 'Одна запись — и её видят все пользователи лаунчера. Обновлять приложение не нужно.';
    document.querySelectorAll('[data-admin-tab]').forEach((button) => {
      button.setAttribute('aria-selected', String(button.dataset.adminTab === tab));
    });
    if (tab === 'plans') refreshPlans();
  }

  // ---- Boot ------------------------------------------------------------

  function showConsole() {
    $('setup-card').classList.add('hidden');
    $('main').classList.remove('hidden');
    refresh();
  }

  $('save-setup').addEventListener('click', async () => {
    const token = $('token').value.trim();
    // Classic (ghp_) and fine-grained (github_pat_) tokens are both accepted.
    if (!/^(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})$/.test(token)) {
      setStatus($('setup-status'), 'Токен должен начинаться с ghp_ или github_pat_.', 'err');
      return;
    }
    state.token = token;
    setStatus($('setup-status'), 'Проверяем доступ…');
    try {
      await readDoc(FILES.notifications);
      const remember = Boolean($('remember-token')?.checked);
      // Only persist after the token proved it can read the file.
      persistToken(token, remember);
      setStatus($('setup-status'), 'Готово.', 'ok');
      showConsole();
    } catch (error) {
      setStatus($('setup-status'), error.message, 'err');
    }
  });

  $('reset-setup').addEventListener('click', () => {
    if (!confirm('Забыть токен в этом браузере?')) return;
    persistToken('', false);
    state.token = '';
    state.shas = {};
    resetPlanEditor();
    switchAdminTab('notifications');
    $('setup-card').classList.remove('hidden');
    $('main').classList.add('hidden');
    $('token').value = '';
    if ($('remember-token')) $('remember-token').checked = false;
    setStatus($('setup-status'), '', '');
  });

  $('publish').addEventListener('click', publish);
  $('reload').addEventListener('click', refresh);
  $('cancel-edit').addEventListener('click', resetEditor);
  $('publish-plan').addEventListener('click', publishPlan);
  $('reload-plans').addEventListener('click', refreshPlans);
  $('cancel-plan-edit').addEventListener('click', resetPlanEditor);
  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    button.addEventListener('click', () => switchAdminTab(button.dataset.adminTab));
  });
  $('title').addEventListener('input', updatePreview);
  $('body').addEventListener('input', updatePreview);
  $('update-log').addEventListener('input', updatePreview);

  // Ctrl+Enter publishes without reaching for the mouse.
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!$('main').classList.contains('hidden')) {
        if (activeTab === 'plans') publishPlan();
        else publish();
      }
    }
  });

  if ($('remember-token')) $('remember-token').checked = initialToken.remembered;
  if (state.token) {
    $('token').value = state.token;
    showConsole();
  }
})();
