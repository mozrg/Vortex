# Vortex — Roblox Place Launcher

Vortex is a Windows desktop launcher for Roblox: search places, keep favorites, track playtime, see which friends are online and jump into their servers -- all outside the browser.

![Version](https://img.shields.io/badge/version-1.0.19-9b7cff) ![Platform](https://img.shields.io/badge/platform-Windows-0078D6) ![License](https://img.shields.io/badge/license-MIT-green)

**Download:** [the website](https://mozrg.github.io/Vortex/) — direct installer link, file size and SHA-256 checksum.

## What's inside

- **Game discovery** — search Roblox places by name or Place ID, browse the discovery catalog, cache results locally.
- **Your shelf** — favorite games, a recent list, and a home page you compose yourself (featured game, picks, greeting, layout).
- **Playtime tracking** — Steam-style hours per game ("12.5 h."), shown on cards on Home / Favorites / Recent / Catalog. Sessions are banked on launch and capped at 3 hours to avoid inflated numbers.
- **Friends** — your Roblox friends list with avatars and statuses. The account is auto-detected from the local Roblox install (no username typing). Hover a card for the game the friend is playing; join their exact server with the play button.
- **Join a friend's server** — launches `roblox://placeId=...&gameInstanceId=...`.
- **Tray menu** — Steam-style compact tray flyout: recent games with thumbnails and "5 min ago" stamps, one-click launch, quit.
- **Launcher settings** — accent palettes, custom theme colors, light/dark/OLED, corners, density, motion/transition effects, tray scale, custom sections order (drag & drop), undo for accidental removals.
- **Data portability** — export/import all launcher data to/from a single file.
- **Auto-update** — checks GitHub Releases, downloads and applies updates with a progress splash.

## Where your data lives

Everything is stored **locally on your machine**. Nothing is uploaded anywhere.

| Data | Location | What |
|---|---|---|
| Launcher preferences, favorites, recent games, playtime stats, search cache, discovery cache | `localStorage` of the app (`vortex.*` keys) in `%APPDATA%\vortex-roblox-launcher` | UI settings, your lists, hours played |
| Roblox username (optional, auto-detected) | same `localStorage` | used to fetch the public friends list |
| `.ROBLOSECURITY` cookie (optional, only if you enable live friend statuses) | `%APPDATA%\vortex-roblox-launcher\rbx-presence.bin` — **encrypted** with Windows DPAPI via Electron `safeStorage` | full account access, stored encrypted, sent only to `presence.roblox.com` for reading friend statuses |
| Update logs | `%APPDATA%\vortex-roblox-launcher\updates` | update apply log |

The friends feature works **without** the cookie: the list itself comes from public Roblox endpoints. The cookie is optional and only needed for exact online/in-game statuses (Roblox hides those from anonymous requests).

Removing the data = deleting the `%APPDATA%\vortex-roblox-launcher` folder. Uninstalling the app does not touch it.

## Network requests

| Endpoint | Why |
|---|---|
| `users.roblox.com`, `friends.roblox.com`, `presence.roblox.com`, `thumbnails.roblox.com`, `games.roblox.com`, `apis.roblox.com` | game search, details, icons, friends, statuses |
| `api.github.com`, `github.com` (releases) | update checks and installer download |
| `roblox://` protocol | launching games |

Roblox endpoints are unofficial and may change. The app never sends telemetry.

## Privacy notes

- No account linking is required for the core app.
- The optional `.ROBLOSECURITY` cookie is validated by Roblox, stored encrypted, and used exclusively to read friend statuses. A warning dialog explains this before it is ever saved.
- No analytics, no telemetry, no data leaves your machine except the API calls above.

## Development

```bash
npm install
npm run build:win   # package the installer (dist/)
npx electron .        # run from source
```

Requires Node.js and Windows. Built with Electron.

## License

MIT.
