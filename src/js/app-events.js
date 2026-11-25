function setView(view, { track = true } = {}) {
  if (view === 'library') view = lastLibraryTab;
  if (libraryTabs.some(tab => tab.id === view)) lastLibraryTab = view;
  if (isRecommendationsView() && view !== currentView) rememberRecommendationScroll();
  if (view === 'activity' && view !== currentView) journalStatus = 'idle';
  if (track && view !== currentView) pushNavigationHistory(view);
  currentView = view;
  if (view !== 'favorites') favoritesVisibleCount = 24;
  // The search tab keeps its own results: switching tabs does not wipe them.
  if (view !== 'catalog' && view !== 'search') {
    searchQuery = '';
    searchInput.value = '';
    activeCategory = preferences.catalogGenre || 'all';
    if (searchTimer) window.clearTimeout(searchTimer);
    searchRequestId += 1;
  }
  renderPage();
  updateNavigationHistoryControls();
  if (view === 'catalog' && !searchQuery) {
    if (isRecommendationsView()) restoreRecommendationScroll();
    else loadDiscoveryCatalog(activeDiscoverySort, { preserveCount: true });
    if (isGenreSearchActive() && (genreStatus === 'idle' || !genreResults.length)) fetchGenreGames(false);
  }
  window.scrollTo({ top: 0, behavior: preferences.motion ? 'smooth' : 'auto' });
}

document.addEventListener('click', async (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (!target) return;
  const notesLink = target.closest('.announcement-body a[href]');
  if (notesLink && window.vortexDesktop?.openAnnouncementLink) {
    event.preventDefault();
    window.vortexDesktop.openAnnouncementLink(notesLink.href);
    return;
  }
  const colorOpen = target.closest('[data-color-open]');
  if (colorOpen) {
    openColorPopover(colorOpen.dataset.colorOpen, colorOpen);
    return;
  }
  // Any click that is not inside the panel or on the bell dismisses it.
  if (announcementPanel && !target.closest('.announcements-panel') && !target.closest('[data-action="notifications"]')) {
    closeAnnouncementsPanel();
  }
  const move = target.closest('[data-ui-move]');
  if (move) {
    moveNavItem(move.dataset.uiMove, move.dataset.direction);
    updateUiRowHandles(move.closest('[data-ui-order]'));
    return;
  }
  const widgetMove = target.closest('[data-widget-move]');
  if (widgetMove) {
    moveHomeWidget(widgetMove.dataset.widgetMove, widgetMove.dataset.direction);
    return;
  }
  const gamePick = target.closest('[data-game-pick]');
  if (gamePick) {
    pickGameFromSearch(gamePick.dataset.gamePick);
    return;
  }
  if (!target.closest('.game-search-field')) closeGameSearch();
  const sortOption = target.closest('[data-sort-value]');
  if (sortOption) {
    sortMode = sortOption.dataset.sortValue;
    renderPage();
    document.querySelector('[data-vortex-dropdown="catalog-sort"] button')?.focus({ preventScroll: true });
    return;
  }

  const windowControl = target.closest('[data-window-control]');
  if (windowControl) {
    const control = windowControl.dataset.windowControl;
    if (control === 'minimize') window.vortexDesktop?.minimizeWindow?.();
    if (control === 'maximize') window.vortexDesktop?.toggleMaximizeWindow?.();
    if (control === 'close') window.vortexDesktop?.closeWindow?.();
    return;
  }

  const quickMethod = target.closest('[data-quick-method]');
  if (quickMethod) { renderQuickGameFields(quickMethod.dataset.quickMethod); document.getElementById('quick-game-error').hidden = true; return; }
  const quickLaunch = target.closest('[data-quick-launch]');
  if (quickLaunch) { void launchQuickGame(quickLaunch.dataset.quickLaunch); return; }
  const quickFolderEdit = target.closest('[data-quick-folder-edit]');
  if (quickFolderEdit) { openQuickFolderModal(quickFolderEdit.dataset.quickFolderEdit); return; }
  const quickFolderToggle = target.closest('[data-quick-folder-toggle]');
  if (quickFolderToggle) {
    const id = quickFolderToggle.dataset.quickFolderToggle;
    const folder = quickFolderToggle.closest('[data-quick-folder]');
    const open = !quickFoldersOpen.has(id);
    if (open) quickFoldersOpen.add(id); else quickFoldersOpen.delete(id);
    folder.setAttribute('aria-expanded', String(open));
    quickFolderToggle.setAttribute('aria-expanded', String(open));
    window.vortexMotion.disclose(folder.querySelector('.quick-folder-children'), open);
    return;
  }
  const quickEdit = target.closest('[data-quick-edit]');
  if (quickEdit) { openQuickGameModal(quickEdit.dataset.quickEdit); return; }
  const quickHotkey = target.closest('[data-quick-hotkey]');
  if (quickHotkey) {
    const item = findQuickLaunchGame(quickHotkey.dataset.quickHotkey);
    if (item?.hotkey) {
      updateQuickLaunchGame(item.id, (entry) => { entry.hotkey = null; });
      savePreferences();
      renderQuickLaunchItems();
      refreshLibraryQuick();
    } else if (item) startQuickLaunchHotkeyRecording(item.id, quickHotkey);
    return;
  }
  const quickShare = target.closest('[data-quick-share]');
  if (quickShare) {
    const item = findQuickLaunchGame(quickShare.dataset.quickShare);
    if (!item) return;
    if (await copyText(encodeQuickLaunchCode(item))) showToast(t('quick.codeCopied'));
    else showToast(t('quick.codeCopyFailed'));
    return;
  }
  const quickRemove = target.closest('[data-quick-remove]');
  if (quickRemove) { removeQuickLaunchItem(quickRemove.dataset.quickRemove); return; }

  const stage = target.closest('[data-roadmap-stage]');
  if (stage) {
    roadmapStage = stage.dataset.roadmapStage;
    renderPage();
    pageContent.querySelector('.plans-filter.active')?.focus();
    return;
  }

  const nav = target.closest('[data-nav]');
  if (nav) {
    const libraryTab = nav.closest('.library-tabs');
    setView(nav.dataset.nav);
    if (libraryTab) focusLibraryControl('.library-tabs [aria-current="page"]');
    return;
  }

  const recorder = target.closest('[data-record-hotkey]');
  if (recorder) { startHotkeyRecording(recorder.dataset.recordHotkey, recorder); return; }

  const action = target.closest('[data-action]');
  if (action) {
    if (action.dataset.action === 'home-settings') {
      preferences.settingsTab = 'home';
      savePreferences();
      setView('settings');
      return;
    }
    if (action.dataset.action === 'history-back') { navigateHistory(-1); return; }
    if (action.dataset.action === 'history-forward') { navigateHistory(1); return; }
    if (action.dataset.action === 'open-update-release') { window.vortexDesktop?.openExternalUrl?.(latestUpdateState?.releaseUrl); return; }
    if (action.dataset.action === 'download-update') {
      if (retryUpdateBusy) return;
      retryUpdateBusy = true;
      renderUpdateBanner({ ...(latestUpdateState || {}), status: 'downloading', progress: 0, errorMessage: null });
      Promise.resolve(window.vortexDesktop?.downloadUpdate?.()).catch((error) => {
        renderUpdateBanner({ ...(latestUpdateState || {}), status: 'error', progress: 0, errorMessage: String(error?.message || error || 'Download failed') });
      }).finally(() => { retryUpdateBusy = false; });
      return;
    }
    if (action.dataset.action === 'install-update') {
      if (retryUpdateBusy) return;
      retryUpdateBusy = true;
      renderUpdateBanner({ ...(latestUpdateState || {}), status: 'applying', progress: 100 });
      Promise.resolve(window.vortexDesktop?.installUpdate?.({
        theme: preferences.theme || 'dark',
        accent: preferences.accent || '#a68bff',
        accentSecondary: preferences.accentSecondary || '#5b3fd6',
        language: preferences.language || 'ru'
      })).catch((error) => {
        retryUpdateBusy = false;
        renderUpdateBanner({ ...(latestUpdateState || {}), status: 'error', progress: 0, errorMessage: String(error?.message || error || 'Install failed') });
      });
      return;
    }
    if (action.dataset.action === 'open-quick-game-modal') { openQuickGameModal(); return; }
    if (action.dataset.action === 'close-quick-game-modal') { closeQuickGameModal(); return; }
    if (action.dataset.action === 'close-quick-folder-modal') { closeQuickFolderModal(); return; }
    if (action.dataset.action === 'import-quick-code') {
      const input = document.querySelector('[data-quick-code]');
      if (importQuickLaunchCode(input?.value)) {
        input.value = '';
        showToast(t('quick.codeImported'));
      } else showToast(t('quick.codeInvalid'));
      return;
    }
    if (action.dataset.action === 'toggle-friends-drawer') {
      if (document.getElementById('friends-drawer')?.classList.contains('is-open')) closeFriendsDrawer();
      else openFriendsDrawer();
      return;
    }
    if (action.dataset.action === 'close-friends-drawer') { closeFriendsDrawer(); return; }
    if (action.dataset.action === 'friends-drawer-view-all') { closeFriendsDrawer(); setView('friends'); return; }
    if (action.dataset.action === 'refresh-friends') {
      const username = String(preferences.robloxUsername || friendsCache.username || '').trim();
      if (username) {
        if (!preferences.robloxUsername) preferences.robloxUsername = username;
        showToast(t('friends.refreshing'));
        void loadFriends(username, true);
      } else {
        showToast(t('friends.refreshing'));
        void autoDetectRobloxAccountOnce(true);
      }
      return;
    }
    if (action.dataset.action === 'refresh-friends-drawer') {
      const username = String(preferences.robloxUsername || friendsCache.username || '').trim();
      if (username) {
        if (!preferences.robloxUsername) preferences.robloxUsername = username;
        void loadFriends(username, true);
      } else void autoDetectRobloxAccountOnce(true);
      return;
    }
    if (action.dataset.action.startsWith('activity-') && handleActivityOverviewAction(action)) return;
    if (action.dataset.action === 'journal-more' || action.dataset.action === 'journal-retry') {
      if (action.dataset.action === 'journal-more') journalLimit += activityJournalPage;
      await loadJournalRows();
      return;
    }
    if (action.dataset.action === 'restore-activity-streak') {
      if (!activityRecoveryAvailable()) return;
      activityData.streak.lastCompletedDate = shiftActivityDate(activityDateKey(), -1);
      activityData.streak.current = Number(activityData.streak.current || 0) + 1;
      activityData.streak.best = Math.max(activityData.streak.best, activityData.streak.current);
      activityData.streak.recoveryUsed = true;
      if (activityQualifiedGames().length >= ACTIVITY_DAILY_GAMES) completeDailyActivity();
      updateActivityAchievements();
      persistActivityData();
      showToast(t('activity.recoveryDone'));
      renderPage();
      return;
    }
    if (action.dataset.action === 'open-social-link') { window.vortexDesktop?.openExternalUrl?.(action.dataset.url); return; }
    if (action.dataset.action === 'toggle-detail-description') { detailDescriptionExpanded = !detailDescriptionExpanded; renderPage(); return; }
    if (action.dataset.action === 'favorites-more') { favoritesVisibleCount += 24; renderPage(); return; }
    if (action.dataset.action === 'paid-more') { showMorePaidGames(); return; }
    if (action.dataset.action === 'paid-rescan') { void loadPaidGames(true); return; }
    if (action.dataset.action === 'clear-pinned-friend-log') {
      if (typeof clearPinnedFriendLog === 'function') clearPinnedFriendLog();
      renderPage();
      return;
    }
    if (action.dataset.action === 'open-integrations-settings') {
      closeFriendsDrawer();
      preferences.settingsTab = 'integrations';
      savePreferences();
      setView('settings');
      requestAnimationFrame(() => pageContent.querySelector('[data-presence-cookie]')?.focus());
      return;
    }
    if (action.dataset.action === 'more-recommendations') { void loadRecommendations(false, true); return; }
    if (action.dataset.action === 'reset-hotkeys') { preferences.hotkeys = {}; savePreferences(); showToast(t('settings.hotkeys.resetDone')); renderPage(); return; }
    if (action.dataset.action === 'check-api-status') { void checkApiStatus(); return; }
    if (action.dataset.action === 'clear-api-cache') { responseCacheLocal.clear(); localStorage.removeItem('vortex.detailCache'); showToast(t('settings.cache.apiCleared')); renderPage(); return; }
    if (action.dataset.action === 'clear-history-cache') {
      for (const key of Object.keys(localStorage)) if (key.startsWith('vortex.onlineHistory.')) localStorage.removeItem(key);
      showToast(t('settings.cache.historyCleared'));
      renderPage();
      return;
    }
    if (action.dataset.action === 'detail-back') {
      if (catalogReturn) returnToSavedCatalog();
      else if (navigationHistoryIndex > 0) navigateHistory(-1);
      else { setView('catalog'); restoreCatalogScroll(); }
      return;
    }
    if (action.dataset.action === 'open-details') { captureCatalogScroll(); openGameDetails(action.dataset.id); return; }
    if (action.dataset.action === 'export-data') {
      let backup;
      try { backup = await buildDataExport(); } catch { showToast(t('tools.backupReadError')); return; }
      const contents = JSON.stringify(backup);
      const filename = `vortex-backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (window.vortexDesktop?.saveShareFile) {
        try {
          const saved = await window.vortexDesktop.saveShareFile({ filename, contents });
          if (saved) showToast(t('settings.data.exported'));
        } catch {
          showToast(t('tools.backupSaveError'));
        }
      } else {
        const blob = new Blob([contents], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast(t('settings.data.exported'));
      }
      return;
    }
    if (action.dataset.action === 'import-data') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        input.remove();
        if (!file) return;
        if (file.size > MAX_BACKUP_BYTES) { showToast(t('tools.backupTooLarge')); return; }
        const reader = new FileReader();
        reader.onerror = () => showToast(t('settings.data.importError'));
        reader.onload = async () => {
          try {
            const payload = JSON.parse(String(reader.result));
            previewLauncherImport(payload);
          } catch { showToast(t('settings.data.importError')); }
        };
        reader.readAsText(file);
      });
      document.body.appendChild(input);
      input.click();
      return;
    }
    if (action.dataset.action === 'favorite') { toggleFavorite(action.dataset.id); return; }
    if (action.dataset.action === 'play') openGame(action.dataset.id);
    if (action.dataset.action === 'rejoin-last-banner') {
      const placeId = action.dataset.id;
      const serverId = action.dataset.server || '';
      if (placeId && typeof triggerServerRejoin === 'function') {
        void triggerServerRejoin({ placeId, serverId });
      } else if (placeId) {
        void openGame(placeId, serverId);
      }
      return;
    }
    if (action.dataset.action === 'refresh-online') { void refreshGameOnline(); return; }
    if (action.dataset.action === 'show-more-badges') { detailBadgeCount += 3; renderPage(); return; }
    if (action.dataset.action === 'toggle-badges') { detailBadgesExpanded = !detailBadgesExpanded; renderPage(); return; }

    if (action.dataset.action === 'toggle-description') {
      const id = String(action.dataset.id);
      if (expandedDescriptions.has(id)) expandedDescriptions.delete(id);
      else expandedDescriptions.add(id);
      renderPage();
    }
    if (action.dataset.action === 'load-more' || action.dataset.action === 'load-more-genre') {
      if (searchQuery.length >= 2) fetchLiveSearch(true);
      else if (isGenreSearchActive()) fetchGenreGames(true);
      else { catalogVisibleCount += CATALOG_PAGE_SIZE; renderPage(); }
      return;
    }
    if (action.dataset.action === 'notifications') toggleAnnouncementsPanel();
    if (action.dataset.action === 'refresh-announcements') {
      action.disabled = true;
      loadAnnouncements({ force: true }).then(() => {
        const card = document.getElementById('announcement-settings-card');
        if (card) card.outerHTML = renderAnnouncementSettings();
        const fresh = document.getElementById('announcement-settings-card');
        if (fresh) fresh.querySelector('[data-action="refresh-announcements"]')?.removeAttribute('disabled');
        showToast(t('notifications.refreshed', { count: announcementItems.length }));
      }).catch(() => {
        action.disabled = false;
        showToast(t('notifications.refreshError'));
      });
    }
    if (action.dataset.action === 'retry-update') {
      if (retryUpdateBusy) return;
      retryUpdateBusy = true;
      const card = action.closest('.settings-card');
      const label = action.querySelector('span') || action;
      const original = label.textContent;
      label.textContent = t('updates.checkingShort');
      action.disabled = true;
      renderUpdateBanner({ status: 'checking', progress: 0 });
      Promise.resolve(window.vortexDesktop?.retryUpdateCheck?.()).catch(() => {}).finally(() => {
        retryUpdateBusy = false;
        if (label.isConnected) { label.textContent = original; action.disabled = false; }
      });
      window.setTimeout(() => { if (latestUpdateState?.status === 'checking') renderUpdateBanner({ status: latestUpdateState.status }); }, 100);
    }
    if (action.dataset.action === 'open-api-status') {
      preferences.settingsTab = 'data';
      savePreferences();
      setView('settings');
      void checkApiStatus();
      return;
    }
    if (action.dataset.action === 'copy-theme-code') {
      const code = typeof encodeThemeCode === 'function' ? encodeThemeCode(preferences) : '';
      if (!code) return;
      const done = () => showToast(t('theme.codeCopied'));
      if (window.vortexDesktop?.copyToClipboard) window.vortexDesktop.copyToClipboard(code).then(done).catch(() => {});
      else navigator.clipboard?.writeText?.(code).then(done).catch(() => {});
      return;
    }
    if (action.dataset.action === 'import-theme-code') {
      const input = document.querySelector('[data-theme-code-input]');
      const decoded = typeof decodeThemeCode === 'function' ? decodeThemeCode(input?.value || '') : null;
      if (!decoded) {
        showToast(t('theme.codeInvalid'));
        return;
      }
      Object.assign(preferences, decoded);
      savePreferences();
      applyPreferences();
      renderPage();
      showToast(t('theme.codeApplied'));
      return;
    }
    if (action.dataset.action === 'clear-cache') {
      Object.keys(localStorage).filter((key) => key.startsWith(SEARCH_CACHE_PREFIX)).forEach((key) => localStorage.removeItem(key));
      localStorage.removeItem('vortex.featuredCache');
      localStorage.removeItem('vortex.discoveryCatalog');
      window.vortexIdbCache?.delete?.('vortex.discoveryCatalog');
      window.vortexIdbCache?.delete?.('vortex.discovered');
      discoveryCatalog = {};
      discoveryStatus = 'idle';
      window.vortexDesktop?.clearSearchCache?.();
      showToast(t('settings.cacheCleared'));
    }
    if (action.dataset.action === 'reset-interface') {
      preferences.sidebarOrder = [];
      preferences.topbarOrder = [];
      preferences.uiSidebarTip = true;
      preferences.uiProfileCard = true;
      preferences.uiTopbarSearch = true;
      preferences.uiBreadcrumb = true;
      preferences.uiNotifications = true;
      preferences.uiSidebarFoot = true;
      preferences.uiUpdateBanner = true;
      preferences.uiTooltips = true;
      savePreferences();
      renderSidebar();
      renderPage();
      showToast(t('settings.ui.resetDone'));
    }
    if (action.dataset.action === 'reset-appearance') {
      const language = preferences.language;
      const saveHistory = preferences.saveHistory;
      Object.assign(preferences, preferenceDefaults, { language, saveHistory, settingsTab: 'general' });
      savePreferences();
      renderPage();
      showToast(t('settings.resetDone'));
    }
    if (action.dataset.action === 'reset-theme-colors') {
      preferences.themeBackground = '';
      preferences.themeSurface = '';
      preferences.themeText = '';
      preferences.themeMuted = '';
      preferences.themeLine = '';
      savePreferences();
      renderPage();
    }
    if (action.dataset.action === 'reset-home-widgets') {
      preferences.homeWidgetOrder = [];
      preferences.homeWidgetHidden = [];
      preferences.homeWidgetCollapsed = [];
      savePreferences();
      renderPage();
      showToast(t('home.widgets.resetDone'));
    }
    if (action.dataset.action === 'save-profile') {
      const name = pageContent.querySelector('[data-profile-name]')?.value;
      if (saveProfileFromCurrent(name)) {
        showToast(t('settings.profiles.saved', { name: String(name).trim() }));
        renderPage();
      } else showToast(t('settings.profiles.needName'));
    }
    if (action.dataset.action === 'export-profiles') {
      const contents = JSON.stringify(readProfiles(), null, 2);
      if (window.vortexDesktop?.saveShareFile) {
        window.vortexDesktop.saveShareFile({ filename: 'vortex-profiles.json', contents })
          .then((saved) => { if (saved) showToast(t('profiles.exported')); })
          .catch(() => showToast(t('profiles.exportFailed')));
      } else {
        const blob = new Blob([contents], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'vortex-profiles.json';
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      return;
    }
    if (action.dataset.action === 'export-theme') {
      const theme = {
        name: 'Vortex theme',
        version: 1,
        theme: preferences.theme,
        background: preferences.themeBackground || '',
        surface: preferences.themeSurface || '',
        text: preferences.themeText || '',
        muted: preferences.themeMuted || '',
        line: preferences.themeLine || '',
        accent: preferences.accent,
        accentSecondary: preferences.accentSecondary,
        gradientAngle: preferences.gradientAngle,
        grain: preferences.themeGrain,
        grainStrength: preferences.themeGrainStrength,
        vignette: preferences.themeVignette,
        vignetteStrength: preferences.themeVignetteStrength
      };
      const contents = JSON.stringify(theme, null, 2);
      if (window.vortexDesktop?.saveShareFile) {
        window.vortexDesktop.saveShareFile({ filename: 'vortex-theme.json', contents })
          .then((saved) => { if (saved) showToast(t('theme.exported')); })
          .catch(() => showToast(t('theme.exportFailed')));
      } else {
        const blob = new Blob([contents], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'vortex-theme.json';
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      return;
    }
    if (action.dataset.action === 'import-theme') {
      pageContent.querySelector('[data-theme-file]')?.click();
      return;
    }
    if (action.dataset.action === 'reset-section-titles') {
      preferences.homeSectionTitles = {};
      savePreferences();
      renderPage();
      showToast(t('settings.home.titlesReset'));
    }
    if (action.dataset.action === 'import-profiles') {
      pageContent.querySelector('[data-profiles-file]')?.click();
    }
    if (action.dataset.action === 'pick-wallpaper') {
      pageContent.querySelector('[data-wallpaper-file]')?.click();
    }
    if (action.dataset.action === 'remove-wallpaper') {
      preferences.themeWallpaper = '';
      savePreferences();
      applyPreferences();
      renderPage();
    }
    if (action.dataset.action === 'toggle-discord-help') {
      discordHelpOpen = !discordHelpOpen;
      action.setAttribute('aria-expanded', String(discordHelpOpen));
      pageContent.querySelector('.discord-help-panel')?.classList.toggle('is-open', discordHelpOpen);
      return;
    }
    if (action.dataset.action === 'save-discord-client') {
      const input = pageContent.querySelector('[data-discord-client-id]');
      const value = String(input?.value || '').replace(/\D/g, '').slice(0, 22);
      if (value && (value.length < 15 || value.length > 22)) { showToast(t('settings.integrations.discordIdInvalid')); return; }
      preferences.discordClientId = value;
      savePreferences();
      try {
        discordStatusCache = await window.vortexDesktop?.setDiscordClientId?.(value);
      } catch { discordStatusCache = null; }
      renderPage();
      refreshDiscordStatus();
      showToast(t('settings.integrations.discordIdSaved'));
      return;
    }
  }

  // Home widget collapse/expand (the chevron in the widget heading).
  const widgetCollapse = target.closest('[data-widget-collapse]');
  if (widgetCollapse) {
    const key = widgetCollapse.dataset.widgetCollapse;
    const list = Array.isArray(preferences.homeWidgetCollapsed) ? preferences.homeWidgetCollapsed.map(String) : [];
    const at = list.indexOf(key);
    if (at >= 0) list.splice(at, 1); else list.push(key);
    preferences.homeWidgetCollapsed = list;
    savePreferences();
    renderPage();
    return;
  }
  const searchSubmit = target.closest('[data-search-page-submit]');
  if (searchSubmit) {
    const input = pageContent.querySelector('[data-search-page-input]');
    submitSearchPage(input ? input.value : searchQuery);
    return;
  }
  const searchClear = target.closest('[data-search-page-clear]');
  if (searchClear) {
    submitSearchPage('');
    return;
  }

  const sidebarHide = target.closest('[data-sidebar-hide]');
  if (sidebarHide) {
    const compact = !document.body.classList.contains('sidebar-compact');
    safeLocalStorageSet('vortex.sidebarCompact', JSON.stringify(compact));
    document.body.classList.toggle('sidebar-compact', compact);
    updateSidebarCollapse();
    return;
  }
  const catalogView = target.closest('[data-catalog-view]');
  if (catalogView) { preferences.catalogView = catalogView.dataset.catalogView === 'list' ? 'list' : 'grid'; savePreferences(); renderPage(); return; }

  const category = target.closest('[data-category]');
  if (category) {
    activeCategory = category.dataset.category;
    preferences.catalogGenre = activeCategory;
    savePreferences();
    // Full reset of genre pagination when the user switches filters.
    genreResults = []; genrePageToken = null; genreStatus = 'idle'; genreLoadingMore = false; genreTermIndex = 0;
    activeGenreRequestId += 1;
    catalogGenreExplore = false;
    paidVisibleCount = PAID_PAGE_SIZE;
    paidExhausted = false;
    if (activeAccess === 'paid') { void loadPaidGames(); renderPage(); document.querySelector('[data-vortex-dropdown="catalog-genre"] button')?.focus({ preventScroll: true }); return; }
    if (isRecommendationsView()) recommendationState.retry = false;
    renderPage();
    document.querySelector('[data-vortex-dropdown="catalog-genre"] button')?.focus({ preventScroll: true });
    return;
  }

  const access = target.closest('[data-access]');
  if (access) {
    activeAccess = access.dataset.access === 'paid' ? 'paid' : 'all';
    preferences.catalogAccess = activeAccess;
    savePreferences();
    paidVisibleCount = PAID_PAGE_SIZE;
    paidExhausted = false;
    if (activeAccess === 'paid') {
      // Re-entering the paid view always starts from the first page again.
      paidStatus = paidGames.length ? 'success' : 'idle';
      if (!paidGames.length) void loadPaidGames();
    }
    renderPage();
    return;
  }

  const catalogCustomize = target.closest('[data-catalog-customize]');
  if (catalogCustomize) { preferences.settingsTab = 'cards'; savePreferences(); setView('settings'); return; }

  const discoverySort = target.closest('[data-discovery-sort]');
  if (discoverySort) {
    selectCatalogCollection(discoverySort.dataset.discoverySort);
    return;
  }

  const tab = target.closest('[data-settings-tab]');
  if (tab) { preferences.settingsTab = tab.dataset.settingsTab; savePreferences(); renderPage(); return; }

  const accent = target.closest('[data-accent]');
  if (accent) {
    // Accent is only an accent: theme colors stay exactly as the user set them.
    preferences.accent = accent.dataset.accent;
    savePreferences();
    renderPage();
    return;
  }

  if (target.closest('[data-add-custom]')) { addCustomGame(); return; }

  const removeCustom = target.closest('[data-remove-custom]');
  if (removeCustom) {
    const id = removeCustom.dataset.removeCustom;
    // Snapshot everything the removal touches, so Undo restores it exactly.
    const snapshot = {
      game: (preferences.customGames || []).find((game) => String(game.id) === id) || null,
      games: preferences.customGames || [],
      featured: preferences.homeFeaturedGame || '',
      picks: preferences.homePicks ? [...preferences.homePicks] : []
    };
    preferences.customGames = (preferences.customGames || []).filter((game) => String(game.id) !== id);
    if (String(preferences.homeFeaturedGame) === id) preferences.homeFeaturedGame = '';
    preferences.homePicks = (preferences.homePicks || []).filter((pick) => String(pick) !== id);
    savePreferences();
    renderPage();
    if (snapshot.game) showToast(
      { message: t('toast.removed', { game: snapshot.game.title }), actionLabel: t('toast.undo'), onAction: () => {
        preferences.customGames = snapshot.games;
        preferences.homeFeaturedGame = snapshot.featured;
        preferences.homePicks = snapshot.picks;
        savePreferences();
        renderPage();
        showToast(t('toast.undone', { game: snapshot.game.title }));
      } }
    );
    return;
  }

  const bannerPick = target.closest('[data-banner-pick]');
  if (bannerPick) {
    const id = String(bannerPick.dataset.bannerPick);
    // Exactly one banner game: choosing it replaces the previous choice; choosing
    // the current banner game again clears the banner.
    preferences.homeFeaturedGame = preferences.homeFeaturedGame === id ? '' : id;
    preferences.homePicks = (preferences.homePicks || []).filter((pick) => String(pick) !== id);
    savePreferences();
    renderPage();
    return;
  }

  const picksPick = target.closest('[data-picks-pick]');
  if (picksPick) {
    const id = String(picksPick.dataset.picksPick);
    const picks = (preferences.homePicks || []).map(String);
    preferences.homePicks = picks.includes(id) ? picks.filter((pick) => pick !== id) : [...picks, id];
    if (preferences.homePicks.includes(id) && preferences.homeFeaturedGame === id) preferences.homeFeaturedGame = '';
    savePreferences();
    renderPage();
    return;
  }

  // Auto-detect the local Roblox account: no typing needed at all.
  if (target.closest('[data-detect-username]')) {
    const input = pageContent.querySelector('[data-roblox-username]');
    if (input) { input.placeholder = t('friends.detecting'); input.value = ''; }
    try {
      const result = await window.vortexDesktop?.detectRobloxAccount();
      if (result && result.ok && result.account && result.account.name) {
        if (input) { input.value = result.account.name; input.placeholder = 'Roblox'; }
        showToast(t('friends.detected', { user: result.account.name }));
        rememberRobloxAccount(result.account);
        if (!preferences.robloxUsername) {
          preferences.robloxUsername = result.account.name;
          friendsCache = { at: 0, data: null };
          savePreferences();
          renderPage();
        }
      } else {
        if (input) input.placeholder = 'Roblox';
        showToast(t('friends.detectFailed'));
      }
    } catch {
      if (input) input.placeholder = 'Roblox';
      showToast(t('friends.detectFailed'));
    }
    return;
  }

  // Saving the Roblox username: show the privacy notice the first time.
  if (target.closest('[data-save-username]')) {
    const input = pageContent.querySelector('[data-roblox-username]');
    const username = String(input?.value || '').trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) { showToast(t('friends.notFound.body')); return; }
    if (!preferences.robloxUsername && !preferences.friendsNoticeAccepted) {
      showFriendsWarning(username);
      return;
    }
    preferences.robloxUsername = username;
    friendsCache = { at: 0, data: null };
    savePreferences();
    renderPage();
    showToast(t('settings.friends.saved'));
    return;
  }

  if (target.closest('[data-save-presence]')) {
    const input = pageContent.querySelector('[data-presence-cookie]');
    const error = pageContent.querySelector('[data-presence-error]');
    const cookie = String(input?.value || '').trim();
    if (error) error.textContent = '';
    if (!cookie) { showToast(t('settings.presence.missing')); return; }
    try {
      const result = await window.vortexDesktop?.setPresenceCookie(cookie, preferences.robloxUsername);
      if (result && result.ok) {
        friendsCache = { at: 0, data: null };
        void refreshRobloxAccount();
        renderPage();
        showToast(t('settings.presence.saved'));
      } else {
        // Inline, specific reason under the field (in addition to the toast).
        const reason = result?.error === 'profile-mismatch' ? t('tools.profileMismatch')
          : result?.error === 'invalid' ? t('settings.presence.tooShort') : t('settings.presence.rejected');
        if (error) error.textContent = reason;
        showToast(reason);
      }
    } catch {
      if (error) error.textContent = t('settings.presence.rejected');
      showToast(t('settings.presence.rejected'));
    }
    return;
  }
  if (target.closest('[data-remove-presence]')) {
    try { await window.vortexDesktop?.removePresenceCookie(); friendsCache = { at: 0, data: null }; renderPage(); showToast(t('settings.presence.disabled')); } catch {}
    return;
  }

  if (target.closest('[data-detect-username-home]')) {
    try {
      const result = await window.vortexDesktop?.detectRobloxAccount();
      if (result && result.ok && result.account && result.account.name) {
        rememberRobloxAccount(result.account);
        preferences.robloxUsername = result.account.name;
        friendsCache = { at: 0, data: null };
        savePreferences();
        renderPage();
        renderFriendsDrawer();
        showToast(t('friends.detected', { user: result.account.name }));
      } else showToast(t('friends.detectFailed'));
    } catch { showToast(t('friends.detectFailed')); }
    return;
  }

  // ---------- Customization profiles: non-action buttons ----------
  const applyProfileBtn = target.closest('[data-apply-profile]');
  if (applyProfileBtn) {
    const ok = applyProfile(applyProfileBtn.dataset.applyProfile);
    showToast(ok ? t('settings.profiles.applied', { name: applyProfileBtn.dataset.applyProfile }) : t('settings.profiles.missing'));
    return;
  }
  const overwriteProfileBtn = target.closest('[data-overwrite-profile]');
  if (overwriteProfileBtn) {
    const name = overwriteProfileBtn.dataset.overwriteProfile;
    saveProfileFromCurrent(name);
    showToast(t('settings.profiles.saved', { name }));
    renderPage();
    return;
  }
  const removeProfileBtn = target.closest('[data-remove-profile]');
  if (removeProfileBtn) {
    const profileName = removeProfileBtn.dataset.removeProfile;
    if (preferences.confirmDelete !== false && typeof confirmVortexAction === 'function') {
      confirmVortexAction({
        title: t('confirm.deleteTitle'),
        body: t('confirm.deleteBody', { title: profileName }),
        confirmText: t('confirm.deleteAction'),
        danger: true
      }).then((ok) => {
        if (!ok) return;
        deleteProfile(profileName);
        renderPage();
      });
    } else {
      deleteProfile(profileName);
      renderPage();
    }
    return;
  }

  const friendJoin = target.closest('[data-friend-join]');
  if (friendJoin) {
    const placeId = friendJoin.dataset.friendJoin;
    const gameId = friendJoin.dataset.friendGame || '';
    closeFriendsDrawer();
    openGame(placeId, gameId);
    return;
  }

  const segment = target.closest('[data-pref]');
  if (segment) {
    preferences[segment.dataset.pref] = segment.dataset.value;
    // Choosing Dark / Light / OLED is a complete theme choice. Custom theme
    // colors left behind by the color picker would otherwise keep overriding it,
    // making the theme buttons look dead.
    if (segment.dataset.pref === 'theme') {
      preferences.themeBackground = '';
      preferences.themeSurface = '';
      preferences.themeText = '';
      preferences.themeMuted = '';
      preferences.themeLine = '';
    }
    savePreferences();
    // Language change re-renders the sidebar too: its labels come from t() at
    // renderSidebar() time, so switching needs a fresh pass, not just renderPage.
    if (segment.dataset.pref === 'language') renderSidebar();
    renderPage();
    if (segment.dataset.pref === 'language') showToast(t('settings.languageUpdated'));
    if (segment.dataset.pref === 'trayScale') { reportRecentGamesToTray(); showToast(t('settings.tray.updated')); }
  }

  // Native button.toggle switches for wallpaper effects and card flags.
  const grainToggle = target.closest('[data-wallpaper-grain-toggle]');
  if (grainToggle) { preferences.themeGrain = !preferences.themeGrain; savePreferences(); applyPreferences(); renderPage(); return; }
  const vignetteToggle = target.closest('[data-wallpaper-vignette-toggle]');
  if (vignetteToggle) { preferences.themeVignette = !preferences.themeVignette; savePreferences(); applyPreferences(); renderPage(); return; }
  const cardFlagToggle = target.closest('[data-card-flag-toggle]');
  if (cardFlagToggle) {
    const flag = cardFlagToggle.dataset.cardFlagToggle;
    if (['cardShowDescription', 'cardShowLikes', 'cardShowPlaytime', 'cardShowGenre'].includes(flag)) {
      preferences[flag] = !preferences[flag];
      savePreferences(); refreshCardPreview();
      // Update the switch's aria state in place (renderPage would drop slider focus).
      cardFlagToggle.setAttribute('aria-checked', String(preferences[flag]));
    }
    return;
  }
  const widgetVisibleToggle = target.closest('[data-widget-visible-toggle]');
  if (widgetVisibleToggle) {
    const key = widgetVisibleToggle.dataset.widgetVisibleToggle;
    const list = Array.isArray(preferences.homeWidgetHidden) ? preferences.homeWidgetHidden.map(String) : [];
    const at = list.indexOf(key);
    if (at >= 0) list.splice(at, 1); else list.push(key);
    preferences.homeWidgetHidden = list;
    savePreferences(); renderPage();
    return;
  }

  const prefToggle = target.closest('[data-pref-toggle]');
  if (prefToggle) {
    const key = prefToggle.dataset.prefToggle;
    preferences[key] = !preferences[key];
    savePreferences(); applyPreferences(); renderPage();
    return;
  }
  const toggle = target.closest('[data-toggle]');
  if (toggle) {
    const key = toggle.dataset.toggle;
    if (key === 'streamMode') { setLauncherStreamMode(!preferences.streamMode); return; }
    preferences[key] = !preferences[key];
    savePreferences();
    if (key === 'discordPresence') { applyDiscordPresence(); showToast(t(preferences.discordPresence ? 'settings.integrations.discordOn' : 'settings.integrations.discordOff')); }
    if (key === 'diskCache') window.vortexDesktop?.setDiskCacheEnabled?.(preferences.diskCache);
    if (key === 'trayMiniPlayer') reportRecentGamesToTray();
    if (key === 'saveHistory' && !preferences.saveHistory) stopJournalRecording();
    renderPage();
    return;
  }
});

// Imported theme files: validate and apply every known field.
document.addEventListener('change', (event) => {
  // Wallpaper image: read as data URL, cap at ~2.5 MB to keep localStorage sane.
  if (event.target.matches('[data-wallpaper-file]')) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast(t('settings.wallpaper.notImage')); return; }
    if (file.size > 2.5 * 1024 * 1024) { showToast(t('settings.wallpaper.tooBig')); return; }
    const reader = new FileReader();
    reader.onload = () => {
      preferences.themeWallpaper = String(reader.result);
      savePreferences();
      applyPreferences();
      renderPage();
      showToast(t('settings.wallpaper.applied'));
    };
    reader.readAsDataURL(file);
    event.target.value = '';
    return;
  }
  // Profiles import (see the change listener above).

  // Imported profiles file: merge known profile objects into storage.
  if (event.target.matches('[data-profiles-file]')) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result));
        if (!imported || typeof imported !== 'object' || Array.isArray(imported)) throw new Error('shape');
        const profiles = readProfiles();
        let count = 0;
        for (const [name, profile] of Object.entries(imported)) {
          const clean = String(name).slice(0, 32);
          if (!clean || !profile || typeof profile !== 'object' || !profile.settings) continue;
          profiles[clean] = { version: 1, savedAt: Number(profile.savedAt) || Date.now(), settings: profile.settings };
          count += 1;
        }
        if (!count) throw new Error('empty');
        writeProfiles(profiles);
        renderPage();
        showToast(t('settings.profiles.imported', { count: String(count) }));
      } catch {
        showToast(t('settings.profiles.importInvalid'));
      }
    };
    reader.readAsText(file);
    event.target.value = '';
    return;
  }

  if (!event.target.matches('[data-theme-file]')) return;
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const theme = JSON.parse(String(reader.result));
      const hex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : '';
      if (['dark', 'light', 'oled'].includes(theme.theme)) preferences.theme = theme.theme;
      preferences.themeBackground = hex(theme.background);
      preferences.themeSurface = hex(theme.surface);
      preferences.themeText = hex(theme.text);
      preferences.themeMuted = hex(theme.muted);
      preferences.themeLine = hex(theme.line);
      if (hex(theme.accent)) preferences.accent = hex(theme.accent);
      if (hex(theme.accentSecondary)) preferences.accentSecondary = hex(theme.accentSecondary);
      if (Number.isFinite(theme.gradientAngle)) preferences.gradientAngle = Math.max(0, Math.min(360, Number(theme.gradientAngle) || 0));
      savePreferences();
      renderPage();
      showToast(t('settings.themeImported'));
    } catch {
      showToast(t('settings.themeImportInvalid'));
    }
  };
  reader.readAsText(file);
  event.target.value = '';
});

document.addEventListener('input', (event) => {
  if (event.target.matches('[data-glass-strength]')) {
    preferences.glassStrength = Math.max(0, Math.min(100, Number(event.target.value) || 0));
    pageContent.querySelector('[data-glass-strength-value]')?.replaceChildren(preferences.glassStrength + '%');
    savePreferences(); applyPreferences();
    return;
  }
  if (event.target.matches('[data-tray-limit]')) {
    const key = event.target.dataset.trayLimit;
    const value = Math.max(1, Math.min(20, Number(event.target.value) || 1));
    preferences[key] = value;
    pageContent.querySelector(`[data-tray-limit-value="${key}"]`)?.replaceChildren(String(value));
    savePreferences();
    return;
  }
  if (event.target.matches('[data-animation-duration]')) {
    preferences.animationDuration = Math.max(0.5, Math.min(2, Number(event.target.value) / 100 || 1));
    event.target.dataset.preview = `animationDuration:${Math.round(preferences.animationDuration * 100)}`;
    pageContent.querySelector('[data-animation-duration-value]')?.replaceChildren(Math.round(preferences.animationDuration * 100) + '%');
    savePreferences(); applyPreferences();
    if (activePreviewTarget === event.target) showHoverPreview(event.target);
    return;
  }
  if (event.target.matches('[data-card-size]')) {
    preferences.cardSize = Math.max(0.7, Math.min(1.3, Number(event.target.value) || 1));
    event.target.dataset.preview = `cardSize:${preferences.cardSize}`;
    pageContent.querySelector('[data-card-size-value]')?.replaceChildren(Math.round(preferences.cardSize * 100) + '%');
    savePreferences(); applyPreferences(); refreshCardPreview();
    if (activePreviewTarget === event.target) showHoverPreview(event.target);
    return;
  }

  if (event.target.matches('[data-card-radius]')) {
    preferences.cardRadius = Math.max(0, Math.min(20, Number(event.target.value) || 0));
    preferences.customCardRadius = true;
    event.target.dataset.preview = `cardRadius:${preferences.cardRadius}`;
    pageContent.querySelector('[data-card-radius-value]')?.replaceChildren(preferences.cardRadius + 'px');
    savePreferences(); applyPreferences(); refreshCardPreview();
    if (activePreviewTarget === event.target) showHoverPreview(event.target);
    return;
  }
  if (event.target.matches('[data-wallpaper-blur]')) {
    preferences.themeWallpaperBlur = Number(event.target.value) || 0;
    pageContent.querySelector('[data-wallpaper-blur-value]')?.replaceChildren(preferences.themeWallpaperBlur + 'px');
    savePreferences(); applyPreferences();
    return;
  }
  if (event.target.matches('[data-wallpaper-dim]')) {
    preferences.themeWallpaperDim = Number(event.target.value) || 0;
    pageContent.querySelector('[data-wallpaper-dim-value]')?.replaceChildren(preferences.themeWallpaperDim + '%');
    savePreferencesDebounced(); applyPreferences();
    return;
  }
  if (event.target.matches('[data-wallpaper-grain-strength]')) {
    preferences.themeGrainStrength = Math.max(0.01, Math.min(0.25, Number(event.target.value) / 100));
    pageContent.querySelector('[data-wallpaper-grain-strength-value]')?.replaceChildren(Math.round(preferences.themeGrainStrength * 100) + '%');
    savePreferencesDebounced(); applyPreferences();
    return;
  }
  if (event.target.matches('[data-wallpaper-vignette-strength]')) {
    preferences.themeVignetteStrength = Math.max(0.1, Math.min(2.5, Number(event.target.value) / 100));
    pageContent.querySelector('[data-wallpaper-vignette-strength-value]')?.replaceChildren(Math.round(preferences.themeVignetteStrength * 100) + '%');
    savePreferencesDebounced(); applyPreferences();
    return;
  }

  if (event.target.matches('[data-presence-cookie]')) {
    // Live length feedback for the pasted cookie.
    const meter = pageContent.querySelector('[data-presence-meter]');
    if (meter) {
      const len = event.target.value.trim().length;
      meter.textContent = len ? len + ' chars' : (meter.dataset.hint || '');
    }
    return;
  }

  if (event.target === searchInput) {
    scheduleLiveSearch(searchInput.value);
    return;
  }
  if (event.target.matches('[data-search-page-input]')) {
    // Typing just updates the query string; search fires only on Enter or
    // the search button — no automatic loading while typing.
    searchQuery = event.target.value;
    return;
  }
  if (event.target.matches('[data-game-search]')) {
    scheduleGameSearch(event.target.value);
    return;
  }
  if (event.target.hasAttribute('data-color-hex')) {
    const name = event.target.dataset.colorHex;
    const value = event.target.value.trim();
    const valid = /^#[0-9a-f]{6}$/i.test(value);
    event.target.setAttribute('aria-invalid', String(!valid));
    if (!valid) return;
    preferences[name] = value.toLowerCase();
    savePreferences();
    applyPreferences();
    syncColorTuner(name, preferences[name]);
    if (name === 'accent') document.querySelectorAll('.palette-option').forEach((button) => button.classList.toggle('active', button.dataset.accent === preferences.accent));
    return;
  }
  if (event.target.hasAttribute('data-color-axis')) {
    const name = event.target.dataset.colorTarget;
    const tuner = pageContent.querySelector(`[data-color-tuner="${name}"]`);
    const value = (axis) => Number(tuner.querySelector(`[data-color-axis="${axis}"]`).value);
    const draggedAxis = event.target.dataset.colorAxis;
    // hslToHex at lightness/saturation extremes loses hue (grey has none), so the
    // hex roundtrip would reset untouched sliders. Remember the slider values and
    // restore them: the sliders stay the source of truth while the user drags.
    const sliderHsl = { hue: value('hue'), saturation: value('saturation'), lightness: value('lightness') };
    preferences[name] = hslToHex(sliderHsl.hue, sliderHsl.saturation, sliderHsl.lightness);
    savePreferencesDebounced();
    applyPreferences();
    syncColorTuner(name, preferences[name], ['hue', 'saturation', 'lightness']);
    // Re-assert every slider from the values the user set (not from the hex).
    for (const axis of ['hue', 'saturation', 'lightness']) {
      const input = tuner.querySelector(`[data-color-axis="${axis}"]`);
      const output = tuner.querySelector(`[data-color-value="${axis}"]`);
      if (input) input.value = sliderHsl[axis];
      if (output) output.value = `${sliderHsl[axis]}${axis === 'hue' ? '°' : '%'}`;
    }
    if (name === 'accent') document.querySelectorAll('.palette-option').forEach((button) => button.classList.toggle('active', button.dataset.accent === preferences.accent));
    return;
  }
  if (event.target.matches('[data-home-greeting]')) {
    preferences.homeGreeting = event.target.value.slice(0, 48);
    savePreferencesDebounced();
    return;
  }
  if (event.target.hasAttribute('data-widget-title')) {
    const key = event.target.dataset.widgetTitle;
    preferences.homeSectionTitles = { ...(preferences.homeSectionTitles || {}), [key]: event.target.value.slice(0, 36) };
    savePreferencesDebounced();
    return;
  }
  if (event.target.matches('[data-home-section-scale]')) {
    preferences.homeSectionScale = Math.max(0.8, Math.min(1.6, Number(event.target.value) || 1));
    pageContent.querySelector('[data-home-section-scale-value]')?.replaceChildren(Math.round(preferences.homeSectionScale * 100) + '%');
    savePreferencesDebounced();
    return;
  }
  if (event.target.matches('[data-setting="glow"]')) {
    preferences.glow = Number(event.target.value);
    event.target.dataset.preview = `glow:${preferences.glow}`;
    savePreferencesDebounced();
    applyPreferences();
    const value = document.getElementById('glow-value');
    if (value) value.textContent = `${preferences.glow}%`;
    if (activePreviewTarget === event.target) showHoverPreview(event.target);
    return;
  }
  if (event.target.matches('[data-setting="gradientAngle"]')) {
    preferences.gradientAngle = Number(event.target.value);
    savePreferencesDebounced();
    applyPreferences();
    const value = document.getElementById('gradient-angle-value');
    if (value) value.textContent = `${preferences.gradientAngle}°`;
  }
});

function syncColorTuner(name, color, axesToSkip = []) {
  const field = pageContent.querySelector(`[data-color-field="${name}"]`);
  if (!field) return;
  const trigger = field.querySelector(`[data-color-open="${name}"]`);
  if (trigger) trigger.dataset.colorCurrent = color;
  field.querySelector('.color-swatch')?.style.setProperty('--sample-color', color);
  const code = field.querySelector(`[data-color-code="${name}"]`);
  if (code) code.textContent = color.toUpperCase();
}

document.addEventListener('keydown', (event) => {
  const isTyping = event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName));
  if (event.key === 'Escape' && !document.getElementById('quick-game-modal')?.hidden) {
    event.preventDefault();
    closeQuickGameModal();
    return;
  }
  if (event.key === 'Escape' && !document.getElementById('quick-folder-modal')?.hidden) {
    event.preventDefault();
    closeQuickFolderModal();
    return;
  }
  if (event.key === 'Escape' && document.getElementById('friends-drawer')?.classList.contains('is-open')) {
    event.preventDefault();
    closeFriendsDrawer();
    document.querySelector('[data-action="toggle-friends-drawer"]')?.focus();
    return;
  }
  if (event.key === 'Tab') {
    const drawer = document.getElementById('friends-drawer');
    if (drawer?.classList.contains('is-open')) {
      const items = [...drawer.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((item) => !item.hidden);
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  // Escape always closes the palette, no matter where focus currently is.
  if (event.key === 'Escape' && paletteOpen()) {
    event.preventDefault();
    closeCommandPalette();
    return;
  }
  // ...and the announcements panel, before any other Escape handling.
  if (event.key === 'Escape' && announcementPanel) {
    event.preventDefault();
    closeAnnouncementsPanel();
    return;
  }
  // User-configurable shortcuts, driven by preferences.hotkeys.
  if (matchesHotkey(event, hotkeyCombo('search'))) {
    event.preventDefault();
    if (paletteOpen()) closeCommandPalette();
    // Ctrl+K focuses the topbar search box instead of opening the palette.
    searchInput.focus();
    searchInput.select?.();
    return;
  }
  if (matchesHotkey(event, hotkeyCombo('palette'))) {
    event.preventDefault();
    if (paletteOpen()) closeCommandPalette();
    else openCommandPalette();
    return;
  }
  if (matchesHotkey(event, hotkeyCombo('settings'))) {
    event.preventDefault();
    if (paletteOpen()) closeCommandPalette();
    setView('settings');
    return;
  }
  if (matchesHotkey(event, hotkeyCombo('friends'))) {
    event.preventDefault();
    if (paletteOpen()) closeCommandPalette();
    setView('friends');
    return;
  }
  if (matchesHotkey(event, hotkeyCombo('sidebar')) && !isTyping) {
    event.preventDefault();
    toggleSidebarVisibility();
    return;
  }
  const quickShortcut = quickLaunchGames().find((item) => item.hotkey && matchesHotkey(event, item.hotkey));
  if (quickShortcut && !isTyping) {
    event.preventDefault();
    void launchQuickGame(quickShortcut.id);
    return;
  }
  // event.target may be document (not an Element), which has no matches().
  const targetIs = (selector) => typeof event.target?.matches === 'function' && event.target.matches(selector);
  if (event.key === 'Enter' && targetIs('[data-search-page-input]')) {
    event.preventDefault();
    submitSearchPage(event.target.value);
    return;
  }
  if (event.key === 'Escape' && targetIs('[data-search-page-input]')) {
    event.preventDefault();
    if (searchQuery) submitSearchPage('');
    return;
  }
  if (event.key === '/' && !isTyping) {
    event.preventDefault();
    searchInput.focus();
    return;
  }
  if (event.key === 'Escape' && paletteOpen()) {
    event.preventDefault();
    closeCommandPalette();
    return;
  }
  if (matchesHotkey(event, hotkeyCombo('back')) && currentView === 'game-detail') {
    event.preventDefault();
    if (navigationHistoryIndex > 0) navigateHistory(-1);
    else { setView('catalog'); restoreCatalogScroll(); }
    return;
  }
  if (event.key === 'Escape' && document.activeElement === searchInput) {
    searchInput.value = '';
    scheduleLiveSearch('');
    searchInput.blur();
  }
});

