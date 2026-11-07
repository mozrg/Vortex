# Vortex Launcher — Rust/Tauri 2

## Статус

Vortex работает на Rust/Tauri 2. Desktop runtime, backend-команды, сборка и зависимости находятся в `src-tauri`; основное окно использует Tauri WebView2.

Основной интерфейс находится в `src/` и загружается непосредственно в Tauri WebView2. В версии 1.1.1 в нём есть история переходов, компактная боковая панель, быстрые Roblox deep links и папки для быстрых запусков.

## Архитектура

- **UI:** HTML/CSS/JS в `src/`, загружается Tauri WebView2.
- **Desktop backend:** Rust-команды в `src-tauri/src/main.rs`.
- **Roblox API:** `src-tauri/src/roblox.rs` — поиск, детали, thumbnails, discovery и кэш.
- **Друзья и presence:** `src-tauri/src/friends.rs`.
- **Локальный кэш:** `src-tauri/src/cache.rs`.
- **Cookie:** `src-tauri/src/cookie.rs`, хранение в `%APPDATA%\\vortex-roblox-launcher\\rbx-presence.bin`.
- **Announcements:** `src-tauri/src/announcements.rs`.
- **Discord Rich Presence:** `src-tauri/src/discord.rs` — Discord IPC на Windows named pipes.
- **Roadmap:** `site/plans.json`, загружается командой `plans_list`; файл также встроен в приложение как офлайн-резерв.
- **JS bridge:** `src/js/desktop.js` переводит вызовы renderer в Tauri `invoke`.

## Сохранённые возможности

Нужно сохранить весь существующий функционал лаунчера Roblox, без добавления магазина или установки игр:

- поиск игр и Place ID;
- каталог Roblox Discover;
- избранное, недавние и локальная статистика времени;
- запуск `roblox://placeId=...` и переход на сервер друга;
- быстрые запуски публичных игр, приватных серверов и share-ссылок RVL;
- друзья, аватары и presence;
- детали плейса, рейтинг, медиа, бейджи и история обновлений;
- tray с последними играми и mini-player;
- темы, акцент, фон, плотность, карточки, анимации, порядок разделов;
- экспорт/импорт данных и профили внешнего вида;
- Discord presence, уведомления и горячие клавиши;
- GitHub update flow и API health checks.

## Разработка

```powershell
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri:dev
npm run tauri:build
```

В системе должны быть Rust, Cargo, Tauri CLI и Windows WebView2. При необходимости Tauri CLI устанавливается командой `cargo install tauri-cli`. Node.js не является runtime приложения.

## Изменение планов и уведомлений

Список карточек вкладки «Планы» хранится в `site/plans.json`. Чтобы добавить или убрать пункт, измените массив `items` и отправьте файл в основную ветку GitHub. Приложение читает опубликованный JSON с GitHub и обновляет кэш не чаще раза в пять минут; без сети использует копию, встроенную при сборке.

Каждый план задаётся полями `id`, `icon`, `title`, `body` и `stage`. Для `title` и `body` укажите переводы `ru` и `en`. Допустимые этапы: `research`, `design`, `dev`, `idea`. Уведомления в `site/notifications.json` поддерживают Markdown: заголовки, списки и вложенные пункты, цитаты, код, выделение и HTTPS-ссылки.
