/**
 * Vortex Desktop API Shim for Tauri 2
 * 
 * Maps window.vortexDesktop.* calls to Tauri invoke() commands. The renderer
 * keeps one stable API while all desktop work runs in Rust.
 */

(function() {
  const TAURI_INVOKE = () => window.__TAURI__?.core?.invoke;

  const invoke = async (command, args = {}) => {
    const fn = TAURI_INVOKE();
    if (!fn) throw new Error('Tauri invoke not available');
    return fn(command, args);
  };

  const handleEvent = (event, callback) => {
    window.__TAURI__?.event?.listen?.(event, (evt) => callback(evt.payload));
    return () => window.__TAURI__?.event?.unlisten?.(event);
  };

  // Global vortexDesktop API.
  window.vortexDesktop = {
    // Window control
    minimizeWindow: () => invoke('window_minimize'),
    toggleMaximizeWindow: () => invoke('window_toggle_maximize'),
    closeWindow: () => invoke('window_close'),
    onWindowState: (callback) => handleEvent('window:state', callback),

    // Updates
    getUpdateState: () => invoke('updates_get_state'),
    retryUpdateCheck: () => invoke('updates_retry'),
    downloadUpdate: () => invoke('updates_download'),
    installUpdate: () => invoke('updates_install'),
    onUpdateState: (callback) => handleEvent('updates:state', callback),

    // Game search and details
    searchGames: (request) => invoke('games_search', request),
    getGameDetails: (request) => invoke('games_details', request),
    getGameOnline: (request) => invoke('games_online', request),
    getSimilarGames: (request) => invoke('games_similar', request),
    getFeaturedGames: (placeIds) => invoke('games_featured', { placeIds }),
    getPaidGames: (request) => invoke('games_paid', request),
    getReleaseHistory: (universeId) => invoke('games_release_history', { universeId }),
    discoverGames: (request) => invoke('games_discover', request),

    // Game launching
    openGame: (placeId, gameId, accessCode) => invoke('open_game', { placeId, gameId, accessCode }),
    launchQuickGame: (request) => invoke('launch_quick_game', request),

    // Cache
    setDiskCacheEnabled: (enabled) => invoke('cache_set_disk_enabled', { enabled }),
    getDiskCacheStats: () => invoke('cache_disk_stats'),
    clearDiskCache: (kind) => invoke('cache_clear_disk', { kind }),
    clearSearchCache: () => invoke('clear_search_cache'),

    // External URLs
    openExternalUrl: (url) => invoke('shell_open_external', { url }),

    // Roblox API status
    getRobloxApiStatus: () => invoke('roblox_api_status'),

    // Friends
    listFriends: (username) => invoke('friends_list', { username }),
    detectRobloxAccount: () => invoke('friends_detect_account'),
    getRobloxAccount: () => invoke('roblox_account'),
    getRobloxRuntime: () => invoke('roblox_runtime_status'),
    setPresenceCookie: (cookie) => invoke('friends_presence_cookie', { cookie }),
    removePresenceCookie: () => invoke('friends_presence_cookie', { remove: true }),
    getPresenceStatus: () => invoke('friends_presence_status'),
    importLegacyLocalStorage: () => invoke('import_legacy_local_storage'),

    // Announcements
    listAnnouncements: (request) => invoke('announcements_list', request),
    listPlans: (request) => invoke('plans_list', request),
    openAnnouncementLink: (url) => invoke('announcements_open', { url }),

    // Discord
    setDiscordEnabled: (enabled) => invoke('discord_set_enabled', { enabled }),
    setDiscordClientId: (clientId) => invoke('discord_set_client_id', { clientId }),
    getDiscordStatus: () => invoke('discord_status'),
    setDiscordActivity: (activity) => invoke('discord_set_activity', { activity }),

    // Notifications
    notifyFriendPlaying: (payload) => invoke('notifications_friend_playing', payload),

    // Tray
    reportRecentGames: (payload) => invoke('report_recent_games', { payload }),
    getTrayState: () => invoke('tray_get_state'),
    onTrayLaunch: (callback) => handleEvent('tray:launch', callback),
  };

  // Inform the renderer that vortexDesktop is ready.
  window.vortexDesktopReady = true;
})();
