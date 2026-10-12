const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/><path d="M8 21v-6h8v6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/>',
  heart: '<path d="M20.8 8.9c0 4.2-8.8 10.2-8.8 10.2S3.2 13.1 3.2 8.9a4.2 4.2 0 0 1 7.5-2.6L12 7.8l1.3-1.5a4.2 4.2 0 0 1 7.5 2.6Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  message: '<path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.1-3.2A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8.5 11.5h.01m3.5 0h.01m3.5 0h.01"/>',
  sliders: '<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M2 14h4m4-6h4m4 8h4"/>',
  dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  bell: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  play: '<path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none"/>',
  sparkle: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  star: '<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.7l6.2-.9z"/>',
  grid: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1.4a2 2 0 0 0 1.5-3.3 1.6 1.6 0 0 1 1.2-2.7h1.2a3.7 3.7 0 0 0 3.7-3.7C21 6.6 17 3 12 3Z"/><path d="M7.5 11h.01M10 7.5h.01m4 0h.01M17 10h.01"/>',
  layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
  motion: '<path d="M5 12h2l3-7 4 14 3-7h2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5 8.7 8.7 0 1 0 20.5 14.2Z"/>',
  contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  arrowUpRight: '<path d="M7 17 17 7M7 7h10v10"/>',
  wave: '<path d="M3 15c2.2 0 2.2-6 4.5-6s2.3 6 4.5 6 2.3-6 4.5-6 2.3 6 4.5 6"/><path d="M4 20h16"/>',
  handWave: '<path d="M7.8 12V5.8a1.7 1.7 0 0 1 3.4 0v4.1-6.1a1.7 1.7 0 0 1 3.4 0v6.1-4.5a1.7 1.7 0 0 1 3.4 0v6.3l.6-1.2a2 2 0 0 1 3.5 1.7l-2.5 5.2a6.3 6.3 0 0 1-5.7 3.6h-1.5a6 6 0 0 1-5.1-2.8l-2.4-3.7a2 2 0 0 1 3.4-2.1l1.5 2V12Z"/><path d="M3 8c1-1 1-2 0-3m3 2c1-1 1-2 0-3"/>',
  gamepad: '<path d="M6.5 11.5h11a4.5 4.5 0 0 1 4.3 5.9l-.5 1.5a2.4 2.4 0 0 1-3.8 1.1L14.8 17h-5.6l-2.7 3a2.4 2.4 0 0 1-3.8-1.1l-.5-1.5a4.5 4.5 0 0 1 4.3-5.9Z"/><path d="M8 8V4m-2 2h4m7 0h.01M19 8h.01"/>',
  sword: '<path d="m14 6 4-3 3 3-3 4m-2-2L8 16m-2 0-3 3 2 2 3-3m-4-2 4 4"/><path d="m15 5 4 4"/>',
  door: '<path d="M5 21V4l14-2v19M5 21h16M9 21V7l7-1v15"/><path d="M13 14h.01"/>',
  mountain: '<path d="m3 19 6-11 4 6 3-4 5 9H3Z"/><path d="m7 12 2 2 2-2m2 2 2 2 2-2"/>',
  crosshair: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  paw: '<path d="M12 13c-3.5 0-6.5 3-6.5 5.3 0 1.5 1 2.7 2.6 2.7 1.4 0 2.2-.8 3.9-.8s2.5.8 3.9.8c1.6 0 2.6-1.2 2.6-2.7C18.5 16 15.5 13 12 13Z"/><ellipse cx="5.5" cy="10" rx="2" ry="2.8" transform="rotate(-24 5.5 10)"/><ellipse cx="10" cy="6.5" rx="2" ry="2.8"/><ellipse cx="15.5" cy="6.5" rx="2" ry="2.8"/><ellipse cx="19" cy="10" rx="2" ry="2.8" transform="rotate(24 19 10)"/>',
  run: '<circle cx="15" cy="5" r="2"/><path d="m12 10 3-2 3 2 2 5m-8-5-2 4-4 2m6-6-1 5 4 2 2 5m-9-5 3 1-2 4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 5v16m5-13h7m-7 4h7"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.2a4 4 0 0 1 0 7.6"/>',
  trophy: '<path d="M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4"/>',
  thumb: '<path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 21h10a2 2 0 0 0 2-1.6l2-8A2 2 0 0 0 19 9h-6l1-5-1-1-6 7"/>',
  flag: '<path d="M5 21V5m0 0c6-4 9 4 15 0v10c-6 4-9-4-15 0"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V4h9l8.6 6.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="8" r="1"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 4-2 4s2.7-.5 4-2c.8-.9.8-2.2-.1-3s-2.1-.9-3 .1Z"/><path d="m12 15-3-3a22 22 0 0 1 2-4c2.5-3.4 6-4.9 10-5-.1 4-1.6 7.5-5 10a22 22 0 0 1-4 2Z"/><path d="M9 12H5l-2 3m9 0v4l-3 2"/><circle cx="15.5" cy="8.5" r="1.5"/>',
  headphones: '<path d="M3 13v-2a9 9 0 0 1 18 0v2"/><path d="M5 13h2v7H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Zm14 0h-2v7h2a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2Z"/>',
  wand: '<path d="m15 4 5 5M4 20l11-11M5 6v4m-2-2h4m11 7v4m-2-2h4"/>',
  slidersHorizontal: '<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  windowMinimize: '<path d="M5 12h14"/>',
  windowMaximize: '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
  windowRestore: '<rect x="8" y="5" width="11" height="11" rx="1.5"/><path d="M16 16v3H5V8h3"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>'
};

const games = [
  { id: '2753915549', title: 'Blox Fruits', genre: 'Приключения', genreKey: 'adventure', art: 'blox', iconKey: 'sword', tag: 'ПРИКЛЮЧЕНИЕ', tagKey: 'adventure', description: 'Путешествуй по морям и открывай способности.', descriptionKey: 'bloxDescription', search: 'блокс фруктс экшен приключение anime anime' },
  { id: '6516141723', title: 'DOORS', genre: 'Хоррор', genreKey: 'horror', art: 'doors', iconKey: 'door', tag: 'ХОРРОР', tagKey: 'horror', description: 'Проверь нервы: за каждой дверью кто-то есть.', descriptionKey: 'doorsDescription', search: 'дурс двери страшная игра хоррор ужасы' },
  { id: '4924922222', title: 'Brookhaven RP', genre: 'Ролевая', genreKey: 'roleplay', art: 'brookhaven', iconKey: 'home', tag: 'РОЛЕВАЯ ИГРА', tagKey: 'roleplay', description: 'Выбери дом, машину и свою историю.', descriptionKey: 'brookhavenDescription', search: 'брукхейвен ролевая город roleplay' },
  { id: '15101393044', title: 'Dress to Impress', genre: 'Мода', genreKey: 'fashion', art: 'dti', iconKey: 'sparkle', tag: 'СТИЛЬ', tagKey: 'style', description: 'Собери образ и выйди на модный подиум.', descriptionKey: 'dtiDescription', search: 'дресс ту импресс мода fashion одежда' },
  { id: '1962086868', title: 'Tower of Hell', genre: 'Паркур', genreKey: 'parkour', art: 'tower', iconKey: 'mountain', tag: 'ПАРКУР', tagKey: 'parkour', description: 'Поднимайся выше и не останавливайся.', descriptionKey: 'towerDescription', search: 'тауэр оф хелл башня паркур обби obby' },
  { id: '286090429', title: 'Arsenal', genre: 'Экшен', genreKey: 'action', art: 'arsenal', iconKey: 'crosshair', tag: 'ЭКШЕН', tagKey: 'action', description: 'Быстрые раунды и смена оружия на ходу.', descriptionKey: 'arsenalDescription', search: 'арсенал шутер экшен fps' },
  { id: '920587237', title: 'Adopt Me!', genre: 'Симулятор', genreKey: 'simulator', art: 'adopt', iconKey: 'paw', tag: 'СИМУЛЯТОР', tagKey: 'simulator', description: 'Заботься о питомцах и обустраивай дом.', descriptionKey: 'adoptDescription', search: 'адопт ми питомцы симулятор животные' },
  { id: '9872472334', title: 'Evade', genre: 'Выживание', genreKey: 'survival', art: 'evade', iconKey: 'run', tag: 'ВЫЖИВАНИЕ', tagKey: 'survival', description: 'Держись рядом с командой и беги к выходу.', descriptionKey: 'evadeDescription', search: 'эвейд выживание escape team' }
];

const palettes = [
  { key: 'amethyst', color: '#9b7cff' },
  { key: 'azure', color: '#59a9f2' },
  { key: 'mint', color: '#55c7a4' },
  { key: 'rose', color: '#ee79ad' },
  { key: 'amber', color: '#e8a94d' },
  { key: 'crimson', color: '#ef626f' },
  { key: 'aqua', color: '#37c3cf' },
  { key: 'lime', color: '#9bc95d' },
  { key: 'orchid', color: '#c274ec' },
  { key: 'slate', color: '#8190a7' }
];

const preferenceDefaults = {
  accent: '#9b7cff', accentMode: 'solid', accentSecondary: '#c274ec', gradientAngle: 135,
  theme: 'dark', themeBackground: '', themeSurface: '',
  density: 'comfortable', corners: 'soft', showDescriptions: true, showStats: true,
  homeGreeting: '', homeFeaturedGame: '2753915549', homeGameCount: 4, homeHeroStyle: 'orbit',
  homeShowHero: true, homeShowRecommendations: true,
  pageTransition: 'fade', cardAnimation: 'rise', glow: 72, ambient: true, motion: true,
  contrast: false, language: 'ru', saveHistory: true, settingsTab: 'home'
};

const translations = {
  ru: {
    'brand.home': 'Vortex — главная', 'window.toolbar': 'Панель окна', 'window.drag': 'Перетащите, чтобы переместить окно', 'window.minimize': 'Свернуть окно', 'window.maximize': 'Развернуть окно', 'window.restore': 'Восстановить размер окна', 'window.close': 'Закрыть окно', 'window.context': 'ТВОЁ ПРОСТРАНСТВО ДЛЯ НОВЫХ МИРОВ', 'sidebar.menu': 'МЕНЮ', 'sidebar.primaryNav': 'Основная навигация', 'sidebar.space': 'ТВОЁ ПРОСТРАНСТВО', 'sidebar.spaceNav': 'Твоё пространство',
    'nav.home': 'Главная', 'nav.catalog': 'Поиск игр', 'nav.favorites': 'Избранное', 'nav.recent': 'Недавние', 'nav.reviews': 'Отзывы', 'nav.plans': 'В планах', 'nav.settings': 'Настройки',
    'common.soon': 'СКОРО', 'sidebar.tip': 'Новый мир уже где-то рядом', 'sidebar.explore': 'Исследовать', 'profile.name': 'Мой лаунчер', 'profile.local': 'Локальный профиль', 'profile.settings': 'Профиль и настройки', 'notifications': 'Уведомления',
    'search.placeholder': 'Найти игру по названию или Place ID...', 'page.home.eyebrow': 'ПРОСТО НАЙТИ СВОЙ МИР', 'page.home.title': 'Привет, игрок', 'page.home.description': 'Меньше долгих поисков — больше игр, которые хочется запустить.',
    'hero.kicker': 'ВЫБОР ПЛЕЙСОВ', 'hero.title': 'Твой следующий игровой мир уже здесь', 'hero.body': 'Собрали разные плейсы Roblox в одном месте. Выбирай настроение, добавляй любимое и запускай в один клик.', 'hero.play': 'Запустить {title}', 'hero.meta': 'популярные плейсы', 'hero.orbit': 'МИРЫ УЖЕ ЖДУТ',
    'home.section.title': 'Может понравиться', 'home.section.subtitle': 'Разные жанры — один быстрый запуск', 'home.allGames': 'Весь каталог', 'home.tipTitle': 'Совет:', 'home.tipBody': 'добавляй игры в избранное, чтобы собрать свою библиотеку.', 'home.favorites': 'Моё избранное', 'home.disclaimer': 'Стартовая подборка.', 'home.disclaimerBody': 'На главной собраны несколько известных миров; по названию можно искать актуальные игры в Roblox.',
    'page.catalog.eyebrow': 'КОЛЛЕКЦИЯ МИРОВ', 'page.catalog.title': 'Поиск игр', 'page.catalog.description': 'Открывай разделы Roblox Discover или ищи игру по названию и Place ID.', 'page.search.eyebrow': 'ПОИСК ПО НАЗВАНИЮ ИЛИ ID', 'page.search.title': 'Результаты поиска', 'search.queryLabel': 'Результаты Roblox для «{query}»',
    'search.live': 'Живая выдача Roblox', 'search.placeId': 'Поиск по Place ID', 'search.placeIdLoading': 'Ищем плейс Roblox…', 'search.resultOne': 'результат', 'search.resultMany': 'результатов', 'search.featuredCount': 'игр из Roblox', 'search.sort': 'Сортировка', 'sort.relevance': 'По релевантности', 'sort.players': 'По числу игроков', 'sort.likes': 'По оценке игроков', 'sort.alpha': 'По алфавиту', 'sort.curated': 'Порядок Roblox', 'sort.reverse': 'Обратный порядок', 'catalog.customize': 'Вид каталога', 'catalog.disclaimerTitle': 'Каталог Roblox.', 'catalog.disclaimer': 'Разделы Discover и статистика обновляются по данным Roblox.',
    'search.shortTitle': 'Продолжи вводить запрос', 'search.shortBody': 'Для поиска нужно хотя бы два символа.', 'search.loading': 'Ищем игры в Roblox…', 'search.loadingNote': 'Это может занять пару секунд', 'search.errorTitle': 'Не удалось подключиться к поиску Roblox.', 'search.errorBody': 'Показаны совпадения из сохранённых игр.', 'search.noMatches': 'Совпадений не найдено', 'search.tryAnother': 'Проверь написание или попробуй другое название.', 'search.noResults': 'Игры не найдены', 'search.tryShorter': 'Попробуй другое название или более короткий запрос.', 'search.loadMore': 'Показать ещё', 'search.loadingMore': 'Загружаем ещё…', 'search.loadMoreError': 'Не получилось загрузить следующие результаты.', 'search.players': '{count} играют', 'search.likes': '{percent}% нравится',
    'genre.all': 'Все', 'genre.adventure': 'Приключения', 'genre.horror': 'Хоррор', 'genre.roleplay': 'Ролевая', 'genre.fashion': 'Мода', 'genre.parkour': 'Паркур', 'genre.action': 'Экшен', 'genre.simulator': 'Симулятор', 'genre.survival': 'Выживание',
    'tag.adventure': 'ПРИКЛЮЧЕНИЕ', 'tag.horror': 'ХОРРОР', 'tag.roleplay': 'РОЛЕВАЯ ИГРА', 'tag.style': 'СТИЛЬ', 'tag.parkour': 'ПАРКУР', 'tag.action': 'ЭКШЕН', 'tag.simulator': 'СИМУЛЯТОР', 'tag.survival': 'ВЫЖИВАНИЕ', 'tag.roblox': 'ROBLOX',
    'game.bloxDescription': 'Путешествуй по морям и открывай способности.', 'game.doorsDescription': 'Проверь нервы: за каждой дверью кто-то есть.', 'game.brookhavenDescription': 'Выбери дом, машину и свою историю.', 'game.dtiDescription': 'Собери образ и выйди на модный подиум.', 'game.towerDescription': 'Поднимайся выше и не останавливайся.', 'game.arsenalDescription': 'Быстрые раунды и смена оружия на ходу.', 'game.adoptDescription': 'Заботься о питомцах и обустраивай дом.', 'game.evadeDescription': 'Держись рядом с командой и беги к выходу.', 'game.creator': 'Игра от {creator}', 'game.found': 'Найдено в каталоге.', 'game.fallbackDescription': 'Открой этот игровой мир.',
    'card.favoriteAdd': 'Добавить в избранное', 'card.favoriteRemove': 'Убрать из избранного', 'card.play': 'Запустить', 'card.readMore': 'Читать полностью', 'card.readLess': 'Свернуть', 'empty.openCatalog': 'Открыть поиск игр', 'empty.noResults': 'Ничего не нашлось', 'empty.filterHint': 'Попробуй изменить запрос или выбрать другой жанр.',
    'page.favorites.eyebrow': 'ТВОЯ КОЛЛЕКЦИЯ', 'page.favorites.title': 'Избранное', 'page.favorites.description': 'Игры, которые ты сохранил на потом.', 'empty.favorites.title': 'Пока здесь тихо', 'empty.favorites.body': 'Нажми на сердечко у понравившейся игры — и она появится в твоей коллекции.',
    'page.recent.eyebrow': 'БЫСТРЫЙ ДОСТУП', 'page.recent.title': 'Недавние', 'page.recent.description': 'Игры, которые ты запускал, будут собраны здесь.', 'empty.recent.title': 'История пока пуста', 'empty.recent.body': 'Запусти игру — она появится в недавних.',
    'page.reviews.eyebrow': 'ИДЕЯ НА БУДУЩЕЕ', 'page.reviews.title': 'Отзывы и оценки', 'page.reviews.description': 'Помоги другим быстрее находить хорошие игры.', 'reviews.title': 'Отзывы появятся в следующих версиях', 'reviews.body': 'Планируем добавить оценки игроков, короткие отзывы и подборки вроде «для игры с друзьями» или «подойдёт новичкам».', 'reviews.soon': 'Скоро',
    'page.plans.eyebrow': 'ДАЛЬШЕ — БОЛЬШЕ', 'page.plans.title': 'В планах', 'page.plans.description': 'Идеи, которые помогут быстрее находить игры и собирать друзей.', 'plans.friends': 'Играть с друзьями', 'plans.friendsBody': 'Приглашения, список друзей и быстрый переход в ту же игру.', 'plans.recommendations': 'Умные рекомендации', 'plans.recommendationsBody': 'Подбирать новые миры по жанрам и сохранённым играм.', 'plans.collections': 'Коллекции и списки', 'plans.collectionsBody': 'Свои подборки: «на вечер», «кооператив» или «попробовать».', 'plans.reviews': 'Отзывы и оценки', 'plans.reviewsBody': 'Оценки игроков, короткие отзывы и подборки сообщества.', 'plans.status': 'В ПЛАНАХ',
    'page.settings.eyebrow': 'ТВОЁ ПРИЛОЖЕНИЕ — ТВОИ ПРАВИЛА', 'page.settings.title': 'Настройки', 'page.settings.description': 'Настрой внешний вид и поведение лаунчера.', 'settings.tab.home': 'Главная', 'settings.tab.accent': 'Внешний вид', 'settings.tab.cards': 'Карточки', 'settings.tab.effects': 'Эффекты', 'settings.tab.general': 'Общие',
    'settings.accent.title': 'Цвет акцента', 'settings.accent.body': 'Выбери цвет — он обновится во всём лаунчере.', 'settings.customColor': 'Свой цвет', 'settings.theme.title': 'Тема приложения', 'settings.theme.body': 'Выбери оформление интерфейса.', 'settings.dark': 'Тёмная', 'settings.light': 'Светлая', 'settings.oled': 'Чёрная', 'settings.preview.title': 'Так будет выглядеть лаунчер', 'settings.preview.body': 'Акцент меняется во всех карточках и кнопках',
    'settings.home.title': 'Главная страница', 'settings.home.body': 'Выбери, что показывать и какую игру вынести вперёд.', 'settings.home.greeting': 'Твоё приветствие', 'settings.home.greetingHint': 'Оставь пустым, чтобы вернуть «Привет, игрок».', 'settings.home.featured': 'Игра на обложке', 'settings.home.sections': 'Блоки главной', 'settings.home.hero': 'Большая обложка', 'settings.home.recommendations': 'Подборка игр', 'settings.home.gameCount': 'Размер подборки', 'settings.home.heroStyle': 'Стиль обложки', 'settings.home.orbit': 'Орбита', 'settings.home.aurora': 'Сияние', 'settings.home.minimal': 'Минимализм',
    'settings.accentMode': 'Заливка акцента', 'settings.solid': 'Сплошная', 'settings.gradient': 'Градиент', 'settings.gradientEnd': 'Второй цвет', 'settings.gradientAngle': 'Направление градиента', 'settings.colorHue': 'Оттенок', 'settings.colorSaturation': 'Насыщенность', 'settings.colorLightness': 'Светлота', 'settings.colorCode': 'HEX-код', 'settings.themeBackground': 'Цвет фона', 'settings.themeSurface': 'Цвет панелей', 'settings.themeColorHint': 'Можно ввести свой HEX-код; настройки применятся сразу.', 'settings.themeReset': 'Цвета темы по умолчанию',
    'settings.density.title': 'Плотность карточек', 'settings.density.body': 'Выбери размер карточек и количество игр в ряду.', 'settings.spacious': 'Крупные', 'settings.comfortable': 'Обычные', 'settings.compact': 'Компактные', 'settings.corners.title': 'Углы карточек', 'settings.corners.body': 'Выбери более мягкий или строгий вид.', 'settings.soft': 'Мягкие', 'settings.sharp': 'Строгие', 'settings.descriptions': 'Описания игр', 'settings.descriptionsBody': 'Показывать короткий текст на карточках.', 'settings.playerStats': 'Статистика игроков', 'settings.playerStatsBody': 'Показывать текущий онлайн и оценку.', 'settings.anyScreen': 'Предпросмотр размера карточек', 'settings.appliesToCatalog': 'Настройка сразу применяется к каталогу',
    'settings.effects.title': 'Атмосфера интерфейса', 'settings.effects.body': 'Свечение и анимации можно настроить отдельно.', 'settings.glow.title': 'Подсветка акцента', 'settings.glow.body': 'Сила цветного свечения в фоне и элементах.', 'settings.ambient.title': 'Свечение фона', 'settings.ambient.body': 'Мягкие цветовые ореолы на заднем плане.', 'settings.motion.title': 'Анимации', 'settings.motion.body': 'Плавные переходы и реакции элементов.', 'settings.transitionStyle': 'Переход между страницами', 'settings.transition.fade': 'Плавный', 'settings.transition.slide': 'Сдвиг', 'settings.transition.zoom': 'Масштаб', 'settings.transition.none': 'Без перехода', 'settings.cardAnimation': 'Появление карточек', 'settings.cards.rise': 'Подъём', 'settings.cards.fade': 'Затухание', 'settings.cards.pop': 'Увеличение', 'settings.cards.none': 'Без анимации', 'settings.contrast.title': 'Повышенный контраст', 'settings.contrast.body': 'Более заметные границы и подписи.', 'settings.savedLocally': 'Настройки сохраняются на этом компьютере.',
    'settings.language.title': 'Язык интерфейса', 'settings.language.body': 'Язык можно поменять в любой момент.', 'settings.language.ru': 'Русский', 'settings.language.en': 'English', 'settings.history.title': 'История запусков', 'settings.history.body': 'Сохранять недавно открытые игры на этом устройстве.', 'settings.cache.title': 'Кэш каталога', 'settings.cache.body': 'Поиск, разделы Discover и обложки хранятся пять минут.', 'settings.cacheClear': 'Очистить кэш каталога', 'settings.reset.title': 'Сбросить настройки внешнего вида', 'settings.reset.body': 'Вернуть исходный цвет, тему и эффекты.', 'settings.resetButton': 'Сбросить внешний вид', 'settings.languageUpdated': 'Язык интерфейса обновлён.', 'settings.cacheCleared': 'Кэш каталога очищен.', 'settings.resetDone': 'Настройки внешнего вида сброшены.',
    'palette.amethyst': 'Аметист', 'palette.azure': 'Лазурь', 'palette.mint': 'Мята', 'palette.rose': 'Роза', 'palette.amber': 'Янтарь', 'palette.crimson': 'Рубин', 'palette.aqua': 'Аква', 'palette.lime': 'Лайм', 'palette.orchid': 'Орхидея', 'palette.slate': 'Сланец', 'palette.Amethyst': 'Amethyst', 'palette.Azure': 'Azure', 'palette.Mint': 'Mint', 'palette.Rose': 'Rose', 'palette.Amber': 'Amber',
    'catalog.loading': 'Загружаем каталог Roblox…', 'catalog.loadingNote': 'Подбираем актуальные игры из Roblox Discover', 'catalog.errorTitle': 'Не удалось загрузить Roblox Discover.', 'catalog.errorBody': 'Показываем игры, которые уже сохранены на устройстве.', 'catalog.loadMore': 'Показать ещё игры',
    'catalog.sort.top-trending': 'В тренде', 'catalog.sort.up-and-coming': 'Набирают популярность', 'catalog.sort.top-playing-now': 'Сейчас играют', 'catalog.sort.fun-with-friends': 'Для игры с друзьями', 'catalog.sort.top-revisited': 'Возвращаются в игру',
    'toast.favoriteAdded': 'Игра добавлена в избранное', 'toast.favoriteRemoved': 'Игра убрана из избранного', 'toast.opening': 'Открываю {game} в Roblox', 'toast.launchError': 'Не удалось открыть Roblox Player.', 'toast.notifications': 'Уведомления появятся в будущих версиях.', 'updates.title': 'Доступно обновление Vortex {version}', 'updates.downloading': 'Загружаем автоматически: {percent}%', 'updates.ready': 'Установщик проверен и готов. Открой его, чтобы обновить лаунчер.', 'updates.open': 'Открыть установщик', 'updates.openError': 'Не удалось открыть установщик.', 'app.title': 'Vortex — Roblox Place Launcher'
  },
  en: {
    'brand.home': 'Vortex — Home', 'window.toolbar': 'Window controls', 'window.drag': 'Drag to move the window', 'window.minimize': 'Minimize window', 'window.maximize': 'Maximize window', 'window.restore': 'Restore window size', 'window.close': 'Close window', 'window.context': 'YOUR SPACE FOR NEW WORLDS', 'sidebar.menu': 'MENU', 'sidebar.primaryNav': 'Primary navigation', 'sidebar.space': 'YOUR SPACE', 'sidebar.spaceNav': 'Your space',
    'nav.home': 'Home', 'nav.catalog': 'Find games', 'nav.favorites': 'Favorites', 'nav.recent': 'Recent', 'nav.reviews': 'Reviews', 'nav.plans': 'In the works', 'nav.settings': 'Settings',
    'common.soon': 'SOON', 'sidebar.tip': 'A new world is closer than it seems', 'sidebar.explore': 'Explore', 'profile.name': 'My launcher', 'profile.local': 'Local profile', 'profile.settings': 'Profile and settings', 'notifications': 'Notifications',
    'search.placeholder': 'Search by game name or Place ID...', 'page.home.eyebrow': 'FIND YOUR NEXT WORLD', 'page.home.title': 'Hey, player', 'page.home.description': 'Less searching, more games you can jump into.',
    'hero.kicker': 'PLACE PICKS', 'hero.title': 'Your next game world is right here', 'hero.body': 'Explore Roblox experiences in one place. Pick a mood, save favorites, and launch with one click.', 'hero.play': 'Play {title}', 'hero.meta': 'popular places', 'hero.orbit': 'WORLDS AWAIT',
    'home.section.title': 'You might like', 'home.section.subtitle': 'Different genres, one quick launch', 'home.allGames': 'Browse all', 'home.tipTitle': 'Tip:', 'home.tipBody': 'save games to favorites and build your own library.', 'home.favorites': 'My favorites', 'home.disclaimer': 'Starter picks.', 'home.disclaimerBody': 'The home page has a few familiar worlds. Search Roblox by name or Place ID.',
    'page.catalog.eyebrow': 'EXPLORE ROBLOX', 'page.catalog.title': 'Find games', 'page.catalog.description': 'Browse Roblox Discover or search by game name and Place ID.', 'page.search.eyebrow': 'SEARCH BY NAME OR ID', 'page.search.title': 'Search results', 'search.queryLabel': 'Roblox results for “{query}”',
    'search.live': 'Live Roblox results', 'search.placeId': 'Place ID lookup', 'search.placeIdLoading': 'Looking up Roblox place…', 'search.resultOne': 'result', 'search.resultMany': 'results', 'search.featuredCount': 'Roblox games', 'search.sort': 'Sort', 'sort.relevance': 'Relevance', 'sort.players': 'Most players', 'sort.likes': 'Player rating', 'sort.alpha': 'Alphabetical', 'sort.curated': 'Roblox order', 'sort.reverse': 'Reverse order', 'catalog.customize': 'Catalog view', 'catalog.disclaimerTitle': 'Roblox catalog.', 'catalog.disclaimer': 'Discover sections and live stats come from Roblox.',
    'search.shortTitle': 'Keep typing', 'search.shortBody': 'Enter at least two characters to search.', 'search.loading': 'Searching Roblox…', 'search.loadingNote': 'This may take a few seconds', 'search.errorTitle': 'Could not reach Roblox search.', 'search.errorBody': 'Showing matches from saved games.', 'search.noMatches': 'No matches found', 'search.tryAnother': 'Check the spelling or try another name.', 'search.noResults': 'No games found', 'search.tryShorter': 'Try a different or shorter search.', 'search.loadMore': 'Load more', 'search.loadingMore': 'Loading more…', 'search.loadMoreError': 'Could not load more results.', 'search.players': '{count} playing', 'search.likes': '{percent}% liked',
    'genre.all': 'All', 'genre.adventure': 'Adventure', 'genre.horror': 'Horror', 'genre.roleplay': 'Roleplay', 'genre.fashion': 'Fashion', 'genre.parkour': 'Parkour', 'genre.action': 'Action', 'genre.simulator': 'Simulator', 'genre.survival': 'Survival',
    'tag.adventure': 'ADVENTURE', 'tag.horror': 'HORROR', 'tag.roleplay': 'ROLEPLAY', 'tag.style': 'STYLE', 'tag.parkour': 'PARKOUR', 'tag.action': 'ACTION', 'tag.simulator': 'SIMULATOR', 'tag.survival': 'SURVIVAL', 'tag.roblox': 'ROBLOX',
    'game.bloxDescription': 'Sail across the seas and discover new abilities.', 'game.doorsDescription': 'Test your nerves: something waits behind every door.', 'game.brookhavenDescription': 'Choose a home, a car, and your own story.', 'game.dtiDescription': 'Style a look and take the runway.', 'game.towerDescription': 'Climb higher and keep moving.', 'game.arsenalDescription': 'Fast rounds and weapons that change on the fly.', 'game.adoptDescription': 'Care for pets and make a home your own.', 'game.evadeDescription': 'Stick with your team and run for the exit.', 'game.creator': 'By {creator}', 'game.found': 'Found in the catalog.', 'game.fallbackDescription': 'Open this game world.',
    'card.favoriteAdd': 'Add to favorites', 'card.favoriteRemove': 'Remove from favorites', 'card.play': 'Play', 'card.readMore': 'Read full description', 'card.readLess': 'Show less', 'empty.openCatalog': 'Search games', 'empty.noResults': 'Nothing found', 'empty.filterHint': 'Try another query or choose a different genre.',
    'page.favorites.eyebrow': 'YOUR COLLECTION', 'page.favorites.title': 'Favorites', 'page.favorites.description': 'Games you saved for later.', 'empty.favorites.title': 'Nothing here yet', 'empty.favorites.body': 'Tap the heart on a game to add it to your collection.',
    'page.recent.eyebrow': 'QUICK ACCESS', 'page.recent.title': 'Recent', 'page.recent.description': 'Games you launch will show up here.', 'empty.recent.title': 'Your history is empty', 'empty.recent.body': 'Launch a game and it will appear here.',
    'page.reviews.eyebrow': 'COMING IN A FUTURE RELEASE', 'page.reviews.title': 'Reviews and ratings', 'page.reviews.description': 'Help other players find great games faster.', 'reviews.title': 'Reviews are coming soon', 'reviews.body': 'We plan to add player ratings, short reviews, and lists like “play with friends” or “good for beginners”.', 'reviews.soon': 'Coming soon',
    'page.plans.eyebrow': 'WHAT’S NEXT', 'page.plans.title': 'In the works', 'page.plans.description': 'Ideas to make discovering games and meeting up easier.', 'plans.friends': 'Play with friends', 'plans.friendsBody': 'Invites, a friends list, and a quick way to join the same game.', 'plans.recommendations': 'Smart recommendations', 'plans.recommendationsBody': 'Find new worlds based on genres and your saved games.', 'plans.collections': 'Collections and lists', 'plans.collectionsBody': 'Create lists like “for tonight”, “co-op”, or “try later”.', 'plans.reviews': 'Reviews and ratings', 'plans.reviewsBody': 'Player ratings, short reviews, and community lists.', 'plans.status': 'PLANNED',
    'page.settings.eyebrow': 'MAKE IT YOURS', 'page.settings.title': 'Settings', 'page.settings.description': 'Customize how the launcher looks and works.', 'settings.tab.home': 'Home', 'settings.tab.accent': 'Appearance', 'settings.tab.cards': 'Cards', 'settings.tab.effects': 'Effects', 'settings.tab.general': 'General',
    'settings.accent.title': 'Accent color', 'settings.accent.body': 'Choose a color to update the whole launcher.', 'settings.customColor': 'Custom color', 'settings.theme.title': 'App theme', 'settings.theme.body': 'Choose an interface style.', 'settings.dark': 'Dark', 'settings.light': 'Light', 'settings.oled': 'OLED', 'settings.preview.title': 'Launcher preview', 'settings.preview.body': 'Your accent appears across cards and buttons',
    'settings.home.title': 'Home page', 'settings.home.body': 'Choose what appears here and which game gets the spotlight.', 'settings.home.greeting': 'Your greeting', 'settings.home.greetingHint': 'Leave blank to use “Hey, player”.', 'settings.home.featured': 'Featured game', 'settings.home.sections': 'Home sections', 'settings.home.hero': 'Featured banner', 'settings.home.recommendations': 'Game picks', 'settings.home.gameCount': 'Number of games', 'settings.home.heroStyle': 'Banner style', 'settings.home.orbit': 'Orbit', 'settings.home.aurora': 'Aurora', 'settings.home.minimal': 'Minimal',
    'settings.accentMode': 'Accent fill', 'settings.solid': 'Solid', 'settings.gradient': 'Gradient', 'settings.gradientEnd': 'Second color', 'settings.gradientAngle': 'Gradient angle', 'settings.colorHue': 'Hue', 'settings.colorSaturation': 'Saturation', 'settings.colorLightness': 'Lightness', 'settings.colorCode': 'HEX code', 'settings.themeBackground': 'Background color', 'settings.themeSurface': 'Panel color', 'settings.themeColorHint': 'Enter a custom HEX code; changes apply immediately.', 'settings.themeReset': 'Restore theme colors',
    'settings.density.title': 'Card size and density', 'settings.density.body': 'Choose card size and how many games fit in a row.', 'settings.spacious': 'Large', 'settings.comfortable': 'Regular', 'settings.compact': 'Compact', 'settings.corners.title': 'Card corners', 'settings.corners.body': 'Choose a softer or sharper look.', 'settings.soft': 'Rounded', 'settings.sharp': 'Sharp', 'settings.descriptions': 'Game descriptions', 'settings.descriptionsBody': 'Show a short description on each card.', 'settings.playerStats': 'Player stats', 'settings.playerStatsBody': 'Show the current player count and rating.', 'settings.anyScreen': 'Card size preview', 'settings.appliesToCatalog': 'Changes apply to the catalog right away',
    'settings.effects.title': 'Interface atmosphere', 'settings.effects.body': 'Adjust glow and motion independently.', 'settings.glow.title': 'Accent glow', 'settings.glow.body': 'Set the strength of colored highlights.', 'settings.ambient.title': 'Background glow', 'settings.ambient.body': 'Soft colored light in the background.', 'settings.motion.title': 'Animations', 'settings.motion.body': 'Smooth transitions and interactive effects.', 'settings.transitionStyle': 'Page transition', 'settings.transition.fade': 'Fade', 'settings.transition.slide': 'Slide', 'settings.transition.zoom': 'Zoom', 'settings.transition.none': 'None', 'settings.cardAnimation': 'Card entrance', 'settings.cards.rise': 'Rise', 'settings.cards.fade': 'Fade', 'settings.cards.pop': 'Pop', 'settings.cards.none': 'None', 'settings.contrast.title': 'High contrast', 'settings.contrast.body': 'Make borders and labels easier to see.', 'settings.savedLocally': 'Settings are saved on this device.',
    'settings.language.title': 'Interface language', 'settings.language.body': 'You can change the language at any time.', 'settings.language.ru': 'Русский', 'settings.language.en': 'English', 'settings.history.title': 'Launch history', 'settings.history.body': 'Save recently opened games on this device.', 'settings.cache.title': 'Catalog cache', 'settings.cache.body': 'Search results, Discover sections, and covers stay cached for five minutes.', 'settings.cacheClear': 'Clear catalog cache', 'settings.reset.title': 'Reset appearance', 'settings.reset.body': 'Restore the default color, theme, and effects.', 'settings.resetButton': 'Reset appearance', 'settings.languageUpdated': 'Interface language updated.', 'settings.cacheCleared': 'Catalog cache cleared.', 'settings.resetDone': 'Appearance settings reset.',
    'palette.amethyst': 'Amethyst', 'palette.azure': 'Azure', 'palette.mint': 'Mint', 'palette.rose': 'Rose', 'palette.amber': 'Amber', 'palette.crimson': 'Crimson', 'palette.aqua': 'Aqua', 'palette.lime': 'Lime', 'palette.orchid': 'Orchid', 'palette.slate': 'Slate',
    'catalog.loading': 'Loading the Roblox catalog…', 'catalog.loadingNote': 'Finding current experiences from Roblox Discover', 'catalog.errorTitle': 'Could not load Roblox Discover.', 'catalog.errorBody': 'Showing games already saved on this device.', 'catalog.loadMore': 'Show more games',
    'catalog.sort.top-trending': 'Trending', 'catalog.sort.up-and-coming': 'Up-and-coming', 'catalog.sort.top-playing-now': 'Playing now', 'catalog.sort.fun-with-friends': 'With friends', 'catalog.sort.top-revisited': 'Revisited',
    'toast.favoriteAdded': 'Added to favorites', 'toast.favoriteRemoved': 'Removed from favorites', 'toast.opening': 'Opening {game} in Roblox', 'toast.launchError': 'Could not open Roblox Player.', 'toast.notifications': 'Notifications are planned for a future release.', 'updates.title': 'Vortex update {version} is available', 'updates.downloading': 'Downloading automatically: {percent}%', 'updates.ready': 'The installer is verified and ready. Open it to update the launcher.', 'updates.open': 'Open installer', 'updates.openError': 'Could not open the installer.', 'app.title': 'Vortex — Roblox Place Launcher'
  }
};

function t(key, values = {}) {
  let result = translations[preferences.language]?.[key] || translations.ru[key] || key;
  for (const [name, value] of Object.entries(values)) result = result.replaceAll(`{${name}}`, String(value));
  return result;
}

const readStored = (key, fallback) => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
};
const preferences = { ...preferenceDefaults, ...readStored('vortex.preferences', {}) };
let favorites = new Set(readStored('vortex.favorites', []));
let recentGames = readStored('vortex.recent', []);
let dynamicGames = readStored('vortex.discovered', []);
const expandedDescriptions = new Set();
let currentView = 'home';
let searchQuery = '';
let activeCategory = 'all';
let sortMode = 'default';
let searchStatus = 'idle';
let searchResults = [];
let searchSessionId = '';
let searchPageToken = null;
let searchRequestId = 0;
let searchTimer = null;
let isLoadingMore = false;
const DISCOVERY_CACHE_TTL = 5 * 60 * 1000;
const CATALOG_PAGE_SIZE = 36;
const fallbackDiscoverySorts = [
  { id: 'top-trending', title: 'Top Trending' },
  { id: 'up-and-coming', title: 'Up-and-Coming' },
  { id: 'top-playing-now', title: 'Top Playing Now' },
  { id: 'fun-with-friends', title: 'Fun with Friends' },
  { id: 'top-revisited', title: 'Top Revisited' }
];
let discoverySorts = readStored('vortex.discoverySorts', []);
let discoveryCatalog = readStored('vortex.discoveryCatalog', {});
let activeDiscoverySort = readStored('vortex.activeDiscoverySort', 'top-trending');
let discoverySessionId = readStored('vortex.discoverySessionId', '') || createSearchSessionId();
let discoveryStatus = 'idle';
let discoveryRequestId = 0;
let catalogVisibleCount = CATALOG_PAGE_SIZE;

const pageContent = document.getElementById('page-content');
const searchInput = document.getElementById('global-search');
const breadcrumbCurrent = document.getElementById('breadcrumb-current');
let latestUpdateState = null;

function icon(name, size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.sparkle}</svg>`;
}

function mountIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((node) => {
    node.innerHTML = icon(node.dataset.icon, 17);
  });
}

function setWindowMaximized(isMaximized) {
  const button = document.querySelector('[data-window-control="maximize"]');
  if (!button) return;
  const key = isMaximized ? 'window.restore' : 'window.maximize';
  const iconName = isMaximized ? 'windowRestore' : 'windowMaximize';
  button.dataset.i18nAria = key;
  button.setAttribute('aria-label', t(key));
  const iconSlot = button.querySelector('[data-icon]');
  if (iconSlot) iconSlot.innerHTML = icon(iconName, 16);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function savePreferences() {
  localStorage.setItem('vortex.preferences', JSON.stringify(preferences));
}

function hexToRgb(hex) {
  const normalized = /^#[0-9a-f]{6}$/i.test(String(hex)) ? String(hex) : '#000000';
  return [1, 3, 5].map((index) => parseInt(normalized.slice(index, index + 2), 16));
}

function rgbToHsl(hex) {
  let [red, green, blue] = hexToRgb(hex).map((channel) => channel / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;
  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue /= 6;
  }
  return { hue: Math.round(hue * 360), saturation: Math.round(saturation * 100), lightness: Math.round(lightness * 100) };
}

function hslToHex(hue, saturation, lightness) {
  const h = ((Number(hue) % 360) + 360) % 360 / 360;
  const s = Math.max(0, Math.min(100, Number(saturation))) / 100;
  const l = Math.max(0, Math.min(100, Number(lightness))) / 100;
  const channel = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `#${[channel(0), channel(8), channel(4)].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function relativeLuminance(hex) {
  const channels = hexToRgb(hex).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function mixHex(first, second, amount) {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  return `#${a.map((value, index) => Math.round(value * (1 - amount) + b[index] * amount).toString(16).padStart(2, '0')).join('')}`;
}

function renderColorTuner(name, color, label) {
  const hsl = rgbToHsl(color);
  const axes = [
    ['hue', 'settings.colorHue', 0, 360],
    ['saturation', 'settings.colorSaturation', 0, 100],
    ['lightness', 'settings.colorLightness', 0, 100]
  ];
  return `<div class="color-tuner" data-color-tuner="${name}">
    <div class="color-tuner-head"><strong>${label}</strong><label class="hex-field"><span class="color-preview" style="--sample-color:${color}"></span><input type="text" value="${color.toUpperCase()}" maxlength="7" spellcheck="false" data-color-hex="${name}" aria-label="${t('settings.colorCode')}" /></label></div>
    <div class="color-tuner-controls">${axes.map(([axis, labelKey, min, max]) => `<label class="color-range"><span>${t(labelKey)}</span><input type="range" min="${min}" max="${max}" value="${hsl[axis]}" data-color-axis="${axis}" data-color-target="${name}" /><output data-color-value="${axis}" data-color-target="${name}">${hsl[axis]}${axis === 'hue' ? '°' : '%'}</output></label>`).join('')}</div>
  </div>`;
}

function applyPreferences() {
  if (!['ru', 'en'].includes(preferences.language)) preferences.language = 'ru';
  if (!['home', 'accent', 'cards', 'effects', 'general'].includes(preferences.settingsTab)) preferences.settingsTab = 'home';
  if (!['dark', 'light', 'oled'].includes(preferences.theme)) preferences.theme = 'dark';
  if (!['solid', 'gradient'].includes(preferences.accentMode)) preferences.accentMode = 'solid';
  if (!['spacious', 'comfortable', 'compact'].includes(preferences.density)) preferences.density = 'comfortable';
  const hex = /^#[0-9a-f]{6}$/i.test(preferences.accent) ? preferences.accent : preferenceDefaults.accent;
  preferences.accent = hex;
  preferences.accentSecondary = /^#[0-9a-f]{6}$/i.test(preferences.accentSecondary) ? preferences.accentSecondary : preferenceDefaults.accentSecondary;
  preferences.gradientAngle = Math.max(0, Math.min(360, Number(preferences.gradientAngle) || 0));
  preferences.themeBackground = /^#[0-9a-f]{6}$/i.test(preferences.themeBackground) ? preferences.themeBackground : '';
  preferences.themeSurface = /^#[0-9a-f]{6}$/i.test(preferences.themeSurface) ? preferences.themeSurface : '';
  if (!['orbit', 'aurora', 'minimal'].includes(preferences.homeHeroStyle)) preferences.homeHeroStyle = 'orbit';
  if (![4, 6, 8].includes(Number(preferences.homeGameCount))) preferences.homeGameCount = 4;
  if (!['fade', 'slide', 'zoom', 'none'].includes(preferences.pageTransition)) preferences.pageTransition = 'fade';
  if (!['rise', 'fade', 'pop', 'none'].includes(preferences.cardAnimation)) preferences.cardAnimation = 'rise';
  preferences.homeGreeting = String(preferences.homeGreeting ?? '').slice(0, 48);
  if (!getGame(preferences.homeFeaturedGame)) preferences.homeFeaturedGame = preferenceDefaults.homeFeaturedGame;
  preferences.glow = Math.max(0, Math.min(100, Number(preferences.glow) || 0));

  const root = document.documentElement.style;
  const accentChannels = hexToRgb(hex);
  const secondaryChannels = hexToRgb(preferences.accentSecondary);
  const channels = accentChannels.join(', ');
  const secondaryRgb = secondaryChannels.join(', ');
  const gradient = `linear-gradient(${preferences.gradientAngle}deg, ${hex}, ${preferences.accentSecondary})`;
  const fillColors = preferences.accentMode === 'gradient' ? [hex, preferences.accentSecondary] : [hex];
  const foregroundContrast = (foreground) => Math.min(...fillColors.map((fill) => {
    const foregroundLuminance = relativeLuminance(foreground);
    const fillLuminance = relativeLuminance(fill);
    return (Math.max(foregroundLuminance, fillLuminance) + 0.05) / (Math.min(foregroundLuminance, fillLuminance) + 0.05);
  }));
  const accentContrast = foregroundContrast('#ffffff') >= foregroundContrast('#17151d') ? '#ffffff' : '#17151d';
  const accentWash = preferences.accentMode === 'gradient'
    ? `linear-gradient(${preferences.gradientAngle}deg, rgba(${channels}, .19), rgba(${secondaryRgb}, .12))`
    : `rgba(${channels}, .14)`;
  const themeBase = {
    dark: { background: '#0b0c10', surface: '#111319' },
    light: { background: '#f2f1f6', surface: '#ffffff' },
    oled: { background: '#030305', surface: '#08090c' }
  }[preferences.theme];
  const background = preferences.themeBackground || themeBase.background;
  const isLightCanvas = relativeLuminance(background) > 0.42;
  const derivedSurface = preferences.themeBackground ? mixHex(background, isLightCanvas ? '#ffffff' : '#000000', isLightCanvas ? 0.78 : 0.48) : themeBase.surface;
  const surface = preferences.themeSurface || derivedSurface;
  const accentHsl = rgbToHsl(hex);
  let accentText = hex;
  for (let step = 0; step < 30; step += 1) {
    const foregroundLuminance = relativeLuminance(accentText);
    const surfaceLuminance = relativeLuminance(surface);
    const contrast = (Math.max(foregroundLuminance, surfaceLuminance) + 0.05) / (Math.min(foregroundLuminance, surfaceLuminance) + 0.05);
    if (contrast >= 4.5) break;
    const nextLightness = Math.max(0, Math.min(100, accentHsl.lightness + (foregroundLuminance > surfaceLuminance ? -3 : 3)));
    if (nextLightness === accentHsl.lightness) break;
    accentHsl.lightness = nextLightness;
    accentText = hslToHex(accentHsl.hue, accentHsl.saturation, accentHsl.lightness);
  }
  root.setProperty('--accent', hex);
  root.setProperty('--accent-secondary', preferences.accentSecondary);
  root.setProperty('--accent-rgb', channels);
  root.setProperty('--accent-secondary-rgb', secondaryRgb);
  root.setProperty('--accent-gradient', gradient);
  root.setProperty('--accent-fill', preferences.accentMode === 'gradient' ? 'var(--accent-gradient)' : 'var(--accent)');
  root.setProperty('--accent-wash', accentWash);
  root.setProperty('--accent-soft', accentWash);
  root.setProperty('--accent-text', accentText);
  root.setProperty('--accent-contrast', accentContrast);
  root.setProperty('--accent-border', `rgba(${channels}, .38)`);
  root.setProperty('--accent-glow', `rgba(${channels}, .34)`);
  root.setProperty('--bg', background);
  root.setProperty('--surface', surface);
  root.setProperty('--surface-2', mixHex(surface, background, 0.42));
  root.setProperty('--surface-3', mixHex(surface, background, 0.72));
  root.setProperty('--text', isLightCanvas ? '#211e2a' : '#f4f4f6');
  root.setProperty('--muted', isLightCanvas ? '#777382' : '#8d909e');
  root.setProperty('--subtle', isLightCanvas ? '#9692a1' : '#636776');
  root.setProperty('--line', isLightCanvas ? 'rgba(38,32,56,.1)' : 'rgba(255,255,255,.075)');
  root.setProperty('--line-strong', isLightCanvas ? 'rgba(38,32,56,.18)' : 'rgba(255,255,255,.13)');
  document.documentElement.style.setProperty('--glow-strength', String(Number(preferences.glow) / 100));
  document.body.classList.toggle('light-theme', isLightCanvas);
  document.body.classList.toggle('oled-theme', preferences.theme === 'oled' && !isLightCanvas);
  document.body.classList.toggle('spacious', preferences.density === 'spacious');
  document.body.classList.toggle('compact', preferences.density === 'compact');
  document.body.classList.toggle('hide-descriptions', !preferences.showDescriptions);
  document.body.classList.toggle('hide-game-stats', !preferences.showStats);
  document.body.classList.toggle('sharp-corners', preferences.corners === 'sharp');
  document.body.classList.toggle('no-motion', !preferences.motion);
  document.body.classList.toggle('no-glow', !preferences.ambient);
  document.body.classList.toggle('high-contrast', preferences.contrast);
  document.body.dataset.cardAnimation = preferences.cardAnimation;
  applyStaticTranslations();
}

function applyStaticTranslations() {
  document.documentElement.lang = preferences.language;
  document.title = t('app.title');
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((element) => {
    element.setAttribute('aria-label', t(element.dataset.i18nAria));
  });
}

function allGames() {
  const knownIds = new Set(games.map((game) => game.id));
  return [...games, ...dynamicGames.filter((game) => game && !knownIds.has(String(game.id)))];
}

function getGame(id) { return allGames().find((game) => game.id === String(id)); }

function localizeGame(game) {
  return {
    ...game,
    genre: game.genreKey ? t(`genre.${game.genreKey}`) : game.genre && game.genre.toLocaleLowerCase() !== 'roblox' ? game.genre : '',
    tag: game.tagKey ? t(`tag.${game.tagKey}`) : game.tag || t('tag.roblox'),
    description: game.descriptionKey ? t(`game.${game.descriptionKey}`) : game.description
  };
}

function formatCount(value) {
  const count = Number(value) || 0;
  return new Intl.NumberFormat(preferences.language === 'ru' ? 'ru-RU' : 'en-US', {
    notation: count >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1
  }).format(count);
}

function formatResultCount(count) {
  if (preferences.language !== 'ru') return `${count} ${count === 1 ? 'result' : 'results'}`;
  const lastTwo = count % 100;
  const last = count % 10;
  const word = last === 1 && lastTwo !== 11 ? 'результат' : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'результата' : 'результатов';
  return `${count} ${word}`;
}

function safeThumbnail(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'tr.rbxcdn.com' ? url.href : '';
  } catch { return ''; }
}

function renderGameCard(game) {
  game = localizeGame(game);
  const isFavorite = favorites.has(game.id);
  const id = escapeHtml(game.id);
  const art = ['blox', 'doors', 'brookhaven', 'dti', 'tower', 'arsenal', 'adopt', 'evade', 'live'].includes(game.art) ? game.art : 'live';
  const thumbnail = safeThumbnail(game.thumbnail);
  const likes = Number(game.upVotes) + Number(game.downVotes) > 0 ? Math.round((Number(game.upVotes) / (Number(game.upVotes) + Number(game.downVotes))) * 100) : null;
  const liveStats = game.live ? `<div class="game-live-stats"><span>${icon('users', 12)} ${t('search.players', { count: formatCount(game.playerCount) })}</span>${likes === null ? '' : `<span>${icon('thumb', 12)} ${t('search.likes', { percent: likes })}</span>`}</div>` : '';
  const creatorLabel = game.creator ? t('game.creator', { creator: escapeHtml(game.creator) }) : '';
  const description = String(game.description || t('game.fallbackDescription')).trim();
  const category = game.genre ? `<span class="game-category"><i></i>${escapeHtml(game.genre)}</span>` : '<span></span>';
  const expandedDescription = expandedDescriptions.has(String(game.id));
  const canExpandDescription = description.length > 100;
  const coverTag = game.tag && game.tag.toLocaleLowerCase() !== t('tag.roblox').toLocaleLowerCase()
    ? `<span class="cover-tag">${escapeHtml(game.tag)}</span>` : '';
  return `<article class="game-card" style="--game-color: var(--accent)" data-game="${id}">
    <div class="game-cover art-${art} ${thumbnail ? 'has-thumbnail' : ''}">
      ${thumbnail ? `<img class="game-thumbnail" src="${escapeHtml(thumbnail)}" alt="" loading="lazy" />` : ''}
      <span class="cover-shine"></span>${coverTag}
      <button class="favorite-button ${isFavorite ? 'is-favorite' : ''}" data-action="favorite" data-id="${id}" aria-label="${isFavorite ? t('card.favoriteRemove') : t('card.favoriteAdd')}" aria-pressed="${isFavorite}">${icon('heart', 15)}</button>
    </div>
    <div class="game-info">
      <div class="game-title-row"><h3 class="game-title">${escapeHtml(game.title)}</h3></div>
      <p class="game-description ${expandedDescription ? 'expanded' : ''}" title="${escapeHtml(description)}">${escapeHtml(description)}</p>
      ${canExpandDescription ? `<button class="description-more" data-action="toggle-description" data-id="${id}" aria-expanded="${expandedDescription}">${t(expandedDescription ? 'card.readLess' : 'card.readMore')}</button>` : ''}
      ${liveStats}
      <div class="game-card-footer">${category}<button class="card-play" data-action="play" data-id="${id}">${icon('play', 11)} ${t('card.play')}</button></div>
    </div>
  </article>`;
}

function renderGrid(list, emptyTitle, emptyText, emptyAction = 'catalog') {
  if (!list.length) {
    return `<div class="empty-state"><div class="empty-icon">${icon(emptyAction === 'favorites' ? 'heart' : 'search', 20)}</div><h2>${emptyTitle}</h2><p>${emptyText}</p><button class="ghost-button" data-nav="${emptyAction}">${t('empty.openCatalog')} ${icon('arrow', 13)}</button></div>`;
  }
  return `<div class="game-grid">${list.map(renderGameCard).join('')}</div>`;
}

function pageHeading(eyebrow, title, description, action = '') {
  return `<div class="page-heading"><div><div class="eyebrow"><span class="eyebrow-mark"></span>${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ''}</div>`;
}

function renderHome() {
  const featured = localizeGame(getGame(preferences.homeFeaturedGame) || games[0]);
  const library = [...new Map([...allGames()].map((game) => [String(game.id), game])).values()];
  const picks = library.filter((game) => String(game.id) !== String(featured.id)).slice(0, Number(preferences.homeGameCount));
  const greeting = preferences.homeGreeting.trim() || t('page.home.title');
  const hero = preferences.homeShowHero ? `<section class="hero-card" data-hero-style="${preferences.homeHeroStyle}">
      <div class="hero-copy"><span class="hero-kicker"><span>${icon('sparkle', 13)}</span> ${t('hero.kicker')}</span><h2>${t('hero.title')}</h2><p>${t('hero.body')}</p>
        <div class="hero-actions"><button class="primary-button" data-action="play" data-id="${escapeHtml(featured.id)}">${icon('play')} ${t('hero.play', { title: escapeHtml(featured.title) })}</button><span class="hero-meta"><span>${icon('sparkle', 12)}</span> ${t('hero.meta')}</span></div>
      </div>
      <div class="hero-art" aria-hidden="true"><div class="hero-rings"></div><span class="hero-star one">${icon('sparkle', 13)}</span><span class="hero-star two">${icon('sparkle', 8)}</span><span class="hero-star three">${icon('sparkle', 9)}</span><div class="hero-orbit-label"><span>${icon('sparkle', 11)}</span> ${t('hero.orbit')}</div></div>
    </section>` : '';
  const recommendations = preferences.homeShowRecommendations ? `<section class="section-block"><div class="section-heading"><div><h2>${t('home.section.title')}</h2><p>${t('home.section.subtitle')}</p></div><button class="link-button" data-nav="catalog">${t('home.allGames')} ${icon('arrow', 13)}</button></div>
      ${renderGrid(picks)}</section>` : '';
  return `${pageHeading(t('page.home.eyebrow'), `<span class="heading-inline-icon">${icon('handWave', 19)}</span>${escapeHtml(greeting)}`, t('page.home.description'))}
    ${hero}${recommendations}
    <p class="catalog-disclaimer"><strong>${t('home.disclaimer')}</strong> ${t('home.disclaimerBody')}</p>`;
}

function filterGames() {
  const query = searchQuery.trim().toLocaleLowerCase(preferences.language);
  const discovered = discoveryCatalog[activeDiscoverySort]?.items;
  let sourceGames = searchQuery ? searchResults : currentView === 'catalog' && Array.isArray(discovered) ? discovered : games;
  let list = sourceGames.filter((game) => {
    const localized = localizeGame(game);
    const matchesQuery = !query || String(game.id).includes(query) || `${game.title} ${localized.genre} ${localized.description} ${game.search || ''}`.toLocaleLowerCase(preferences.language).includes(query);
    const matchesCategory = searchQuery || activeCategory === 'all' || game.genreKey === activeCategory;
    return matchesQuery && matchesCategory;
  });
  if (sortMode === 'alpha') list = list.slice().sort((first, second) => first.title.localeCompare(second.title, preferences.language));
  if (sortMode === 'recent') list = list.slice().reverse();
  if (sortMode === 'players') list = list.slice().sort((first, second) => (second.playerCount || 0) - (first.playerCount || 0));
  if (sortMode === 'likes') list = list.slice().sort((first, second) => {
    const score = (game) => (Number(game.upVotes) + Number(game.downVotes)) ? Number(game.upVotes) / (Number(game.upVotes) + Number(game.downVotes)) : 0;
    return score(second) - score(first);
  });
  return list;
}

function discoverySortLabel(sort) {
  const key = `catalog.sort.${sort.id}`;
  const translated = t(key);
  return translated === key ? sort.title : translated;
}

function renderCustomSortSelect(isLiveSearch) {
  const options = [
    { value: 'default', label: t(isLiveSearch ? 'sort.relevance' : 'sort.curated') },
    { value: 'players', label: t('sort.players') },
    { value: 'likes', label: t('sort.likes') },
    { value: 'alpha', label: t('sort.alpha') }
  ];
  const selected = options.find((option) => option.value === sortMode) || options[0];
  return `<div class="custom-select" data-custom-select>
    <button class="custom-select-trigger" type="button" data-sort-toggle aria-haspopup="listbox" aria-expanded="false" aria-label="${t('search.sort')}"><span>${escapeHtml(selected.label)}</span>${icon('chevronDown', 13)}</button>
    <div class="custom-select-menu" role="listbox" aria-label="${t('search.sort')}" hidden>${options.map((option) => `<button class="custom-select-option" type="button" role="option" aria-selected="${sortMode === option.value}" data-sort-value="${option.value}">${escapeHtml(option.label)}</button>`).join('')}</div>
  </div>`;
}

function renderCatalog() {
  const list = filterGames();
  const availableSorts = discoverySorts.length ? discoverySorts : fallbackDiscoverySorts;
  const selectedSort = availableSorts.find((sort) => sort.id === activeDiscoverySort) || availableSorts[0];
  const queryLabel = searchQuery ? t('search.queryLabel', { query: escapeHtml(searchQuery) }) : t('page.catalog.description');
  const isLiveSearch = searchQuery.length >= 2;
  const isPlaceId = /^\d{5,20}$/.test(searchQuery.trim());
  const controls = isLiveSearch
    ? `<div class="live-search-caption"><span class="live-search-dot"></span>${isPlaceId ? t('search.placeId') : t('search.live')}</div>${renderCustomSortSelect(true)}`
    : `<div class="filter-row discovery-sort-row" role="tablist" aria-label="${t('page.catalog.title')}">${availableSorts.map((sort) => `<button class="filter-chip ${activeDiscoverySort === sort.id ? 'active' : ''}" role="tab" aria-selected="${activeDiscoverySort === sort.id}" data-discovery-sort="${escapeHtml(sort.id)}">${escapeHtml(discoverySortLabel(sort))}</button>`).join('')}</div>${renderCustomSortSelect(false)}`;
  let resultsBody = '';
  if (searchQuery.length === 1) {
    resultsBody = `<div class="empty-state"><div class="empty-icon">${icon('search', 20)}</div><h2>${t('search.shortTitle')}</h2><p>${t('search.shortBody')}</p></div>`;
  } else if (isLiveSearch && searchStatus === 'loading') {
    resultsBody = `<div class="search-loading"><span class="loading-spinner"></span><strong>${isPlaceId ? t('search.placeIdLoading') : t('search.loading')}</strong><small>${t('search.loadingNote')}</small></div>`;
  } else if (isLiveSearch && searchStatus === 'error') {
    resultsBody = `<p class="catalog-disclaimer"><strong>${t('search.errorTitle')}</strong> ${t('search.errorBody')}</p>${renderGrid(list, t('search.noMatches'), t('search.tryAnother'))}`;
  } else if (isLiveSearch && searchStatus === 'success') {
    resultsBody = `<p class="result-note">${formatResultCount(list.length)}</p>${renderGrid(list, t('search.noResults'), t('search.tryShorter'))}${isLoadingMore ? `<div class="load-more-status"><span class="loading-spinner small"></span>${t('search.loadingMore')}</div>` : searchPageToken ? `<button class="ghost-button load-more-button" data-action="load-more">${t('search.loadMore')} ${icon('arrow', 13)}</button>` : ''}`;
  } else if (!searchQuery && discoveryStatus === 'loading') {
    resultsBody = `<div class="search-loading"><span class="loading-spinner"></span><strong>${t('catalog.loading')}</strong><small>${t('catalog.loadingNote')}</small></div>`;
  } else {
    const cachedItems = discoveryCatalog[activeDiscoverySort]?.items || [];
    const offlineNote = discoveryStatus === 'error' ? `<p class="catalog-disclaimer"><strong>${t('catalog.errorTitle')}</strong> ${t('catalog.errorBody')}</p>` : '';
    const loadMore = catalogVisibleCount < list.length ? `<button class="ghost-button load-more-button" data-action="load-more">${t('catalog.loadMore')} ${icon('arrow', 13)}</button>` : '';
    const note = cachedItems.length ? `<p class="result-note">${formatResultCount(list.length)} · ${escapeHtml(discoverySortLabel(selectedSort))}</p>` : '';
    resultsBody = `${offlineNote}${note}${renderGrid(list.slice(0, catalogVisibleCount), t('empty.noResults'), t('empty.filterHint'))}${loadMore}`;
  }
  return `${pageHeading(searchQuery ? t('page.search.eyebrow') : t('page.catalog.eyebrow'), searchQuery ? t('page.search.title') : t('page.catalog.title'), queryLabel, `<button class="ghost-button" data-nav="settings">${icon('sliders')} ${t('catalog.customize')}</button>`)}
    <div class="catalog-controls">${controls}</div>${resultsBody}
    ${isLiveSearch ? '' : discoveryStatus === 'loading' ? '' : `<p class="catalog-disclaimer"><strong>${t('catalog.disclaimerTitle')}</strong> ${t('catalog.disclaimer')}</p>`}`;
}

function renderFavorites() {
  const list = allGames().filter((game) => favorites.has(game.id));
  return `${pageHeading(t('page.favorites.eyebrow'), t('page.favorites.title'), t('page.favorites.description'))}
    ${renderGrid(list, t('empty.favorites.title'), t('empty.favorites.body'), 'catalog')}`;
}

function renderRecent() {
  const list = recentGames.map(getGame).filter(Boolean);
  return `${pageHeading(t('page.recent.eyebrow'), t('page.recent.title'), t('page.recent.description'))}
    ${renderGrid(list, t('empty.recent.title'), t('empty.recent.body'), 'catalog')}`;
}

function renderReviews() {
  return `${pageHeading(t('page.reviews.eyebrow'), t('page.reviews.title'), t('page.reviews.description'))}
    <section class="review-banner"><div class="review-illustration">${icon('message', 25)}</div><div><h2>${t('reviews.title')}</h2><p>${t('reviews.body')}</p></div><button class="ghost-button review-cta" disabled aria-disabled="true">${icon('clock')} ${t('reviews.soon')}</button></section>`;
}

function renderPlans() {
  const plans = [
    ['users', 'plans.friends', 'plans.friendsBody'],
    ['trophy', 'plans.recommendations', 'plans.recommendationsBody'],
    ['flag', 'plans.collections', 'plans.collectionsBody'],
    ['message', 'plans.reviews', 'plans.reviewsBody']
  ];
  return `${pageHeading(t('page.plans.eyebrow'), t('page.plans.title'), t('page.plans.description'))}
    <div class="roadmap-grid">${plans.map(([iconName, titleKey, bodyKey]) => `<article class="roadmap-card"><div class="roadmap-icon">${icon(iconName)}</div><h3>${t(titleKey)}</h3><p>${t(bodyKey)}</p><span class="roadmap-state">${t('plans.status')}</span></article>`).join('')}</div>`;
}

function settingsTabs() {
  const tabs = [ ['home', 'home'], ['accent', 'palette'], ['cards', 'layout'], ['effects', 'motion'], ['general', 'slidersHorizontal'] ];
  return `<div class="settings-tabs">${tabs.map(([key, iconName]) => `<button class="settings-tab ${preferences.settingsTab === key ? 'active' : ''}" data-settings-tab="${key}"><span>${icon(iconName)}</span>${t(`settings.tab.${key}`)}</button>`).join('')}</div>`;
}

function renderHomeSettings() {
  const featuredGame = getGame(preferences.homeFeaturedGame) || games[0];
  const choices = games.map((game) => `<button class="home-game-option ${String(game.id) === String(featuredGame.id) ? 'active' : ''}" data-home-featured="${escapeHtml(game.id)}" aria-pressed="${String(game.id) === String(featuredGame.id)}"><span class="home-game-art art-${game.art}"></span><span class="home-game-copy"><strong>${escapeHtml(game.title)}</strong><small>${escapeHtml(localizeGame(game).genre)}</small></span></button>`).join('');
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.home.title')}</h2><p>${t('settings.home.body')}</p></div>${icon('home', 18)}</div>
      <label class="home-greeting-field"><span>${t('settings.home.greeting')}</span><input type="text" maxlength="48" value="${escapeHtml(preferences.homeGreeting)}" placeholder="${t('settings.home.greetingHint')}" data-home-greeting /></label>
      <div class="setting-line home-featured-head"><div class="setting-label"><strong>${t('settings.home.featured')}</strong></div></div><div class="home-game-options">${choices}</div>
      <div class="setting-line home-setting-line"><div class="setting-label"><strong>${t('settings.home.gameCount')}</strong></div><div class="segmented"><button class="segment ${Number(preferences.homeGameCount) === 4 ? 'active' : ''}" data-pref="homeGameCount" data-value="4">4</button><button class="segment ${Number(preferences.homeGameCount) === 6 ? 'active' : ''}" data-pref="homeGameCount" data-value="6">6</button><button class="segment ${Number(preferences.homeGameCount) === 8 ? 'active' : ''}" data-pref="homeGameCount" data-value="8">8</button></div></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.home.heroStyle')}</strong></div><div class="segmented"><button class="segment ${preferences.homeHeroStyle === 'orbit' ? 'active' : ''}" data-pref="homeHeroStyle" data-value="orbit">${t('settings.home.orbit')}</button><button class="segment ${preferences.homeHeroStyle === 'aurora' ? 'active' : ''}" data-pref="homeHeroStyle" data-value="aurora">${t('settings.home.aurora')}</button><button class="segment ${preferences.homeHeroStyle === 'minimal' ? 'active' : ''}" data-pref="homeHeroStyle" data-value="minimal">${t('settings.home.minimal')}</button></div></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.home.sections')}</h2><p>${t('settings.home.body')}</p></div>${icon('layout', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.home.hero')}</strong></div><button class="toggle" role="switch" aria-checked="${preferences.homeShowHero}" data-toggle="homeShowHero" aria-label="${t('settings.home.hero')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.home.recommendations')}</strong></div><button class="toggle" role="switch" aria-checked="${preferences.homeShowRecommendations}" data-toggle="homeShowRecommendations" aria-label="${t('settings.home.recommendations')}"></button></div>
    </section>`;
}

function renderAccentSettings() {
  const themeDefaults = { dark: { background: '#0b0c10', surface: '#111319' }, light: { background: '#f2f1f6', surface: '#ffffff' }, oled: { background: '#030305', surface: '#08090c' } }[preferences.theme];
  const displayBackground = preferences.themeBackground || themeDefaults.background;
  const displaySurface = preferences.themeSurface || themeDefaults.surface;
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.accent.title')}</h2><p>${t('settings.accent.body')}</p></div>${icon('palette', 18)}</div>
      <div class="palette-row">${palettes.map((palette) => `<button class="palette-option ${preferences.accent.toLowerCase() === palette.color ? 'active' : ''}" data-accent="${palette.color}"><span class="palette-swatch" style="background:${palette.color};color:${palette.color}"></span>${t(`palette.${palette.key}`)}</button>`).join('')}</div>
      ${renderColorTuner('accent', preferences.accent, t('settings.customColor'))}
      <div class="setting-line accent-mode-line"><div class="setting-label"><strong>${t('settings.accentMode')}</strong></div><div class="segmented"><button class="segment ${preferences.accentMode === 'solid' ? 'active' : ''}" data-pref="accentMode" data-value="solid">${t('settings.solid')}</button><button class="segment ${preferences.accentMode === 'gradient' ? 'active' : ''}" data-pref="accentMode" data-value="gradient">${t('settings.gradient')}</button></div></div>
      ${preferences.accentMode === 'gradient' ? `<div class="gradient-options">${renderColorTuner('accentSecondary', preferences.accentSecondary, t('settings.gradientEnd'))}<label class="gradient-angle"><span>${t('settings.gradientAngle')}</span><input type="range" min="0" max="360" value="${preferences.gradientAngle}" data-setting="gradientAngle" /><output id="gradient-angle-value">${preferences.gradientAngle}°</output></label><div class="gradient-preview" aria-hidden="true"></div></div>` : ''}
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.theme.title')}</h2><p>${t('settings.theme.body')}</p></div></div><div class="segmented" style="max-width:390px"><button class="segment ${preferences.theme === 'dark' ? 'active' : ''}" data-pref="theme" data-value="dark">${icon('moon', 13)} ${t('settings.dark')}</button><button class="segment ${preferences.theme === 'light' ? 'active' : ''}" data-pref="theme" data-value="light">${icon('sun', 13)} ${t('settings.light')}</button><button class="segment ${preferences.theme === 'oled' ? 'active' : ''}" data-pref="theme" data-value="oled">${icon('contrast', 13)} ${t('settings.oled')}</button></div>
      <p class="theme-color-hint">${t('settings.themeColorHint')}</p><div class="theme-color-tuners">${renderColorTuner('themeBackground', displayBackground, t('settings.themeBackground'))}${renderColorTuner('themeSurface', displaySurface, t('settings.themeSurface'))}</div>
      <button class="text-button theme-reset" data-action="reset-theme-colors">${t('settings.themeReset')}</button>
      <div class="settings-preview" style="margin-top:17px"><div class="preview-thumb"></div><div class="preview-copy"><strong>${t('settings.preview.title')}</strong><small>${t('settings.preview.body')}</small></div></div>
    </section>`;
}

function renderCardSettings() {
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.density.title')}</h2><p>${t('settings.density.body')}</p></div>${icon('grid', 18)}</div>
      <div class="segmented density-segmented"><button class="segment ${preferences.density === 'spacious' ? 'active' : ''}" data-pref="density" data-value="spacious">${t('settings.spacious')}</button><button class="segment ${preferences.density === 'comfortable' ? 'active' : ''}" data-pref="density" data-value="comfortable">${t('settings.comfortable')}</button><button class="segment ${preferences.density === 'compact' ? 'active' : ''}" data-pref="density" data-value="compact">${t('settings.compact')}</button></div>
      <div class="setting-line" style="margin-top:13px"><div class="setting-label"><strong>${t('settings.corners.title')}</strong><small>${t('settings.corners.body')}</small></div><div class="segmented"><button class="segment ${preferences.corners === 'soft' ? 'active' : ''}" data-pref="corners" data-value="soft">${t('settings.soft')}</button><button class="segment ${preferences.corners === 'sharp' ? 'active' : ''}" data-pref="corners" data-value="sharp">${t('settings.sharp')}</button></div></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.descriptions')}</strong><small>${t('settings.descriptionsBody')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.showDescriptions}" data-toggle="showDescriptions" aria-label="${t('settings.descriptions')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.playerStats')}</strong><small>${t('settings.playerStatsBody')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.showStats}" data-toggle="showStats" aria-label="${t('settings.playerStats')}"></button></div>
      <div class="settings-preview"><div class="density-preview-art" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="preview-copy"><strong>${t('settings.anyScreen')}</strong><small>${t('settings.appliesToCatalog')}</small></div></div>
    </section>`;
}

function renderEffectSettings() {
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.effects.title')}</h2><p>${t('settings.effects.body')}</p></div>${icon('wand', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.glow.title')}</strong><small>${t('settings.glow.body')}</small></div><label class="range-control"><input type="range" min="0" max="100" value="${preferences.glow}" data-setting="glow" /><span class="range-value" id="glow-value">${preferences.glow}%</span></label></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.ambient.title')}</strong><small>${t('settings.ambient.body')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.ambient}" data-toggle="ambient" aria-label="${t('settings.ambient.title')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.motion.title')}</strong><small>${t('settings.motion.body')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.motion}" data-toggle="motion" aria-label="${t('settings.motion.title')}"></button></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.transitionStyle')}</strong></div><div class="segmented animation-segmented"><button class="segment ${preferences.pageTransition === 'fade' ? 'active' : ''}" data-pref="pageTransition" data-value="fade">${t('settings.transition.fade')}</button><button class="segment ${preferences.pageTransition === 'slide' ? 'active' : ''}" data-pref="pageTransition" data-value="slide">${t('settings.transition.slide')}</button><button class="segment ${preferences.pageTransition === 'zoom' ? 'active' : ''}" data-pref="pageTransition" data-value="zoom">${t('settings.transition.zoom')}</button><button class="segment ${preferences.pageTransition === 'none' ? 'active' : ''}" data-pref="pageTransition" data-value="none">${t('settings.transition.none')}</button></div></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.cardAnimation')}</strong></div><div class="segmented animation-segmented"><button class="segment ${preferences.cardAnimation === 'rise' ? 'active' : ''}" data-pref="cardAnimation" data-value="rise">${t('settings.cards.rise')}</button><button class="segment ${preferences.cardAnimation === 'fade' ? 'active' : ''}" data-pref="cardAnimation" data-value="fade">${t('settings.cards.fade')}</button><button class="segment ${preferences.cardAnimation === 'pop' ? 'active' : ''}" data-pref="cardAnimation" data-value="pop">${t('settings.cards.pop')}</button><button class="segment ${preferences.cardAnimation === 'none' ? 'active' : ''}" data-pref="cardAnimation" data-value="none">${t('settings.cards.none')}</button></div></div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.contrast.title')}</strong><small>${t('settings.contrast.body')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.contrast}" data-toggle="contrast" aria-label="${t('settings.contrast.title')}"></button></div>
    </section><p class="catalog-disclaimer">${t('settings.savedLocally')}</p>`;
}

function renderGeneralSettings() {
  return `<section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.language.title')}</h2><p>${t('settings.language.body')}</p></div>${icon('message', 18)}</div>
      <div class="segmented language-segmented"><button class="segment ${preferences.language === 'ru' ? 'active' : ''}" data-pref="language" data-value="ru">${t('settings.language.ru')}</button><button class="segment ${preferences.language === 'en' ? 'active' : ''}" data-pref="language" data-value="en">${t('settings.language.en')}</button></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.history.title')}</h2><p>${t('settings.history.body')}</p></div>${icon('clock', 18)}</div>
      <div class="setting-line"><div class="setting-label"><strong>${t('settings.history.title')}</strong><small>${t('settings.history.body')}</small></div><button class="toggle" role="switch" aria-checked="${preferences.saveHistory}" data-toggle="saveHistory" aria-label="${t('settings.history.title')}"></button></div>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.cache.title')}</h2><p>${t('settings.cache.body')}</p></div>${icon('search', 18)}</div>
      <button class="ghost-button" data-action="clear-cache">${icon('close', 13)} ${t('settings.cacheClear')}</button>
    </section>
    <section class="settings-card"><div class="settings-card-head"><div><h2>${t('settings.reset.title')}</h2><p>${t('settings.reset.body')}</p></div>${icon('slidersHorizontal', 18)}</div>
      <button class="ghost-button" data-action="reset-appearance">${icon('motion', 13)} ${t('settings.resetButton')}</button>
    </section>`;
}

function renderSettings() {
  const panel = preferences.settingsTab === 'home' ? renderHomeSettings() : preferences.settingsTab === 'cards' ? renderCardSettings() : preferences.settingsTab === 'effects' ? renderEffectSettings() : preferences.settingsTab === 'general' ? renderGeneralSettings() : renderAccentSettings();
  return `${pageHeading(t('page.settings.eyebrow'), t('page.settings.title'), t('page.settings.description'))}
    <div class="settings-layout">${settingsTabs()}<div class="settings-panel">${panel}</div></div>`;
}

const viewNames = { home: 'nav.home', catalog: 'nav.catalog', favorites: 'nav.favorites', recent: 'nav.recent', reviews: 'nav.reviews', plans: 'nav.plans', settings: 'nav.settings' };

function updateSidebar() {
  document.querySelectorAll('[data-nav]').forEach((button) => button.classList.toggle('active', button.dataset.nav === currentView));
  breadcrumbCurrent.textContent = searchQuery && currentView === 'catalog' ? t('page.search.title') : t(viewNames[currentView] || 'nav.home');
}

function renderPage() {
  applyPreferences();
  updateSidebar();
  renderUpdateBanner();
  const pages = { home: renderHome, catalog: renderCatalog, favorites: renderFavorites, recent: renderRecent, reviews: renderReviews, plans: renderPlans, settings: renderSettings };
  pageContent.innerHTML = (pages[currentView] || renderHome)();
  mountIcons(pageContent);
  if (pageContent.dataset.renderedView !== currentView) {
    pageContent.dataset.renderedView = currentView;
    pageContent.dataset.transition = preferences.motion ? preferences.pageTransition : 'none';
    pageContent.classList.remove('page-entering');
    void pageContent.offsetWidth;
    pageContent.classList.add('page-entering');
  }
}

function renderUpdateBanner(state) {
  if (state) latestUpdateState = state;
  const banner = document.getElementById('update-banner');
  if (!banner) return;
  if (!latestUpdateState || !['downloading', 'downloaded'].includes(latestUpdateState.status)) {
    banner.hidden = true;
    banner.innerHTML = '';
    return;
  }
  const isDownloaded = latestUpdateState.status === 'downloaded';
  const progress = Math.max(0, Math.min(100, Number(latestUpdateState.progress) || 0));
  const title = isDownloaded
    ? t('updates.title', { version: escapeHtml(latestUpdateState.latestVersion || '') })
    : t('updates.title', { version: escapeHtml(latestUpdateState.latestVersion || '') });
  const message = isDownloaded ? t('updates.ready') : t('updates.downloading', { percent: progress });
  banner.hidden = false;
  banner.innerHTML = `<span class="update-banner-icon">${icon(isDownloaded ? 'check' : 'sparkle', 18)}</span><span class="update-banner-copy"><strong>${title}</strong><small>${escapeHtml(message)}</small></span>${isDownloaded ? `<button class="ghost-button" data-action="open-update-installer">${icon('download', 13)} ${t('updates.open')}</button>` : `<span class="update-banner-progress" aria-label="${progress}%"><i style="--progress:${progress}%"></i></span>`}`;
}

let toastTimer;
function showToast(message) {
  const region = document.getElementById('toast-region');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="toast-mark">${icon('sparkle', 13)}</span><span>${escapeHtml(message)}</span>`;
  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3000);
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { region.innerHTML = ''; }, 3400);
}

function openGame(id) {
  const game = getGame(id);
  if (!game) return;
  if (preferences.saveHistory) {
    recentGames = [game.id, ...recentGames.filter((recentId) => recentId !== game.id)].slice(0, 12);
    localStorage.setItem('vortex.recent', JSON.stringify(recentGames));
  }
  if (window.vortexDesktop?.openGame) {
    window.vortexDesktop.openGame(game.id).then(() => showToast(t('toast.opening', { game: game.title }))).catch(() => showToast(t('toast.launchError')));
  } else {
    window.open(`https://www.roblox.com/games/start?placeId=${encodeURIComponent(game.id)}`, '_blank', 'noopener,noreferrer');
    showToast(t('toast.opening', { game: game.title }));
  }
}

const SEARCH_CACHE_PREFIX = 'vortex.searchCache.';
const SEARCH_CACHE_TTL = 5 * 60 * 1000;

function getCachedSearch(query) {
  const key = SEARCH_CACHE_PREFIX + encodeURIComponent(query.toLocaleLowerCase());
  const cached = readStored(key, null);
  if (!cached || Date.now() - cached.savedAt > SEARCH_CACHE_TTL) {
    localStorage.removeItem(key);
    return null;
  }
  return cached;
}

function saveCachedSearch(query) {
  const key = SEARCH_CACHE_PREFIX + encodeURIComponent(query.toLocaleLowerCase());
  try {
    const keys = Object.keys(localStorage).filter((storedKey) => storedKey.startsWith(SEARCH_CACHE_PREFIX) && storedKey !== key);
    if (keys.length >= 20) {
      const oldest = keys.map((storedKey) => [storedKey, readStored(storedKey, null)?.savedAt || 0]).sort((a, b) => a[1] - b[1]);
      oldest.slice(0, keys.length - 19).forEach(([storedKey]) => localStorage.removeItem(storedKey));
    }
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), items: searchResults, nextPageToken: searchPageToken, sessionId: searchSessionId }));
  } catch {
    // Search remains available if local storage is full or disabled.
  }
}

async function hydrateFeaturedGames() {
  if (!window.vortexDesktop?.getFeaturedGames) return;
  const cached = readStored('vortex.featuredCache', null);
  if (cached && Date.now() - cached.savedAt < SEARCH_CACHE_TTL) {
    const byId = new Map((cached.items || []).map((game) => [String(game.id), game]));
    games.forEach((game) => { const updated = byId.get(game.id); if (updated) Object.assign(game, updated, { live: true }); });
    if (currentView === 'home') renderPage();
    return;
  }
  try {
    const items = await window.vortexDesktop.getFeaturedGames(games.map((game) => game.id));
    const byId = new Map((items || []).map((game) => [String(game.id), game]));
    games.forEach((game) => { const updated = byId.get(game.id); if (updated) Object.assign(game, updated, { live: true }); });
    try { localStorage.setItem('vortex.featuredCache', JSON.stringify({ savedAt: Date.now(), items })); } catch { /* Keep the hydrated cards in memory. */ }
    if (currentView === 'home') renderPage();
  } catch {
    // Local starter cards remain usable if Roblox's public API is unavailable.
  }
}

function normalizeDiscoveredGame(game, query = '') {
  const creator = String(game.creator || '');
  return {
    ...game,
    id: String(game.id),
    title: String(game.title || t('game.fallbackDescription')),
    creator,
    genre: String(game.genre || '').toLocaleLowerCase() === 'roblox' ? '' : String(game.genre || ''),
    tagKey: 'roblox',
    art: 'live',
    iconKey: 'gamepad',
    description: String(game.description || t('game.fallbackDescription')),
    live: true,
    search: query
  };
}

async function loadDiscoveryCatalog(sortId = activeDiscoverySort, { force = false } = {}) {
  activeDiscoverySort = sortId;
  localStorage.setItem('vortex.activeDiscoverySort', JSON.stringify(activeDiscoverySort));
  const cached = discoveryCatalog[sortId];
  if (!force && cached?.savedAt && Date.now() - cached.savedAt < DISCOVERY_CACHE_TTL && Array.isArray(cached.items)) {
    discoveryStatus = 'success';
    renderPage();
    return;
  }

  const requestId = ++discoveryRequestId;
  discoveryStatus = 'loading';
  catalogVisibleCount = CATALOG_PAGE_SIZE;
  renderPage();
  try {
    if (!window.vortexDesktop?.discoverGames) throw new Error('Roblox Discover is available in the desktop app.');
    const response = await window.vortexDesktop.discoverGames({ sortId, sessionId: discoverySessionId });
    if (requestId !== discoveryRequestId) return;

    discoverySessionId = response.sessionId || discoverySessionId;
    discoverySorts = Array.isArray(response.sorts) && response.sorts.length ? response.sorts : fallbackDiscoverySorts;
    activeDiscoverySort = response.selectedSortId || sortId;
    const items = (response.items || []).map((game) => normalizeDiscoveredGame(game));
    discoveryCatalog = {
      ...discoveryCatalog,
      [activeDiscoverySort]: { savedAt: Date.now(), items }
    };

    const knownIds = new Set(dynamicGames.map((game) => String(game.id)));
    const newGames = items.filter((game) => !knownIds.has(game.id));
    dynamicGames = [...dynamicGames, ...newGames].slice(-1200);
    try {
      localStorage.setItem('vortex.discoverySessionId', JSON.stringify(discoverySessionId));
      localStorage.setItem('vortex.discoverySorts', JSON.stringify(discoverySorts));
      localStorage.setItem('vortex.discoveryCatalog', JSON.stringify(discoveryCatalog));
      localStorage.setItem('vortex.discovered', JSON.stringify(dynamicGames));
    } catch { /* Live results stay available for this session if storage is full. */ }
    discoveryStatus = 'success';
    renderPage();
  } catch {
    if (requestId !== discoveryRequestId) return;
    discoveryStatus = 'error';
    renderPage();
  }
}

function createSearchSessionId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0;
    return (character === 'x' ? random : (random & 3 | 8)).toString(16);
  });
}

async function fetchLiveSearch(append = false) {
  const query = searchQuery.trim();
  if (query.length < 2) return;
  const requestId = ++searchRequestId;
  if (!append) {
    const cached = getCachedSearch(query);
    if (cached) {
      searchResults = cached.items || [];
      searchPageToken = cached.nextPageToken || null;
      searchSessionId = cached.sessionId || createSearchSessionId();
      searchStatus = 'success';
      isLoadingMore = false;
      renderPage();
      return;
    }
  }
  if (append) isLoadingMore = true;
  else {
    searchStatus = 'loading';
    searchResults = [];
    searchPageToken = null;
    searchSessionId = createSearchSessionId();
  }
  renderPage();

  try {
    if (!window.vortexDesktop?.searchGames) throw new Error('Live Roblox search is available in the desktop app.');
    const response = await window.vortexDesktop.searchGames({
      query,
      sessionId: searchSessionId,
      pageToken: append ? searchPageToken : null
    });
    if (requestId !== searchRequestId || query !== searchQuery.trim()) return;

    const received = (response.items || []).map((game) => ({
      ...game,
      id: String(game.id),
      title: String(game.title || t('game.fallbackDescription')),
      creator: String(game.creator || ''),
      genre: String(game.genre || '').toLocaleLowerCase() === 'roblox' ? '' : String(game.genre || ''),
      tagKey: 'roblox',
      art: 'live',
      iconKey: 'gamepad',
      description: String(game.description || t('game.fallbackDescription')),
      live: true,
      search: query
    }));
    const knownIds = new Set(searchResults.map((game) => game.id));
    const newItems = received.filter((game) => !knownIds.has(game.id));
    searchResults = append ? [...searchResults, ...newItems] : received;
    const storedGames = new Map(dynamicGames.map((game) => [String(game.id), game]));
    received.forEach((game) => storedGames.set(game.id, game));
    dynamicGames = [...storedGames.values()].slice(-800);
    try { localStorage.setItem('vortex.discovered', JSON.stringify(dynamicGames)); } catch { /* Current search results remain in memory. */ }
    searchSessionId = response.sessionId || searchSessionId;
    searchPageToken = response.nextPageToken || null;
    searchStatus = 'success';
    isLoadingMore = false;
    saveCachedSearch(query);
    renderPage();
  } catch {
    if (requestId !== searchRequestId) return;
    isLoadingMore = false;
    if (append) {
      showToast(t('search.loadMoreError'));
      renderPage();
      return;
    }
    searchStatus = 'error';
    searchResults = games.filter((game) => game.id === query || `${game.title} ${game.genre} ${game.description} ${game.search}`.toLocaleLowerCase(preferences.language).includes(query.toLocaleLowerCase(preferences.language)));
    searchPageToken = null;
    renderPage();
  }
}

function scheduleLiveSearch(value) {
  searchQuery = value;
  currentView = 'catalog';
  activeCategory = 'all';
  sortMode = 'default';
  searchStatus = value.trim().length >= 2 ? 'loading' : value.trim().length ? 'short' : 'idle';
  searchResults = [];
  searchPageToken = null;
  isLoadingMore = false;
  searchRequestId += 1;
  if (searchTimer) window.clearTimeout(searchTimer);
  renderPage();
  searchInput.focus();
  searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
  if (value.trim().length >= 2) searchTimer = window.setTimeout(() => fetchLiveSearch(false), 420);
  else if (!value.trim() && !discoveryCatalog[activeDiscoverySort]?.items) loadDiscoveryCatalog(activeDiscoverySort);
}

function toggleFavorite(id) {
  if (favorites.has(id)) {
    favorites.delete(id);
    showToast(t('toast.favoriteRemoved'));
  } else {
    favorites.add(id);
    showToast(t('toast.favoriteAdded'));
  }
  localStorage.setItem('vortex.favorites', JSON.stringify([...favorites]));
  renderPage();
}

function setView(view) {
  currentView = view;
  if (view !== 'catalog') {
    searchQuery = '';
    searchInput.value = '';
    activeCategory = 'all';
    if (searchTimer) window.clearTimeout(searchTimer);
    searchRequestId += 1;
  }
  renderPage();
  if (view === 'catalog' && !searchQuery) loadDiscoveryCatalog(activeDiscoverySort);
  window.scrollTo({ top: 0, behavior: preferences.motion ? 'smooth' : 'auto' });
}

document.addEventListener('click', (event) => {
  const sortToggle = event.target.closest('[data-sort-toggle]');
  if (sortToggle) {
    const select = sortToggle.closest('[data-custom-select]');
    const menu = select.querySelector('.custom-select-menu');
    const shouldOpen = menu.hidden;
    document.querySelectorAll('[data-custom-select]').forEach((item) => {
      item.querySelector('.custom-select-menu').hidden = true;
      item.querySelector('[data-sort-toggle]').setAttribute('aria-expanded', 'false');
    });
    if (shouldOpen) {
      menu.hidden = false;
      sortToggle.setAttribute('aria-expanded', 'true');
      menu.querySelector('.custom-select-option[aria-selected="true"]')?.focus();
    }
    return;
  }

  const sortOption = event.target.closest('[data-sort-value]');
  if (sortOption) {
    sortMode = sortOption.dataset.sortValue;
    renderPage();
    return;
  }
  document.querySelectorAll('[data-custom-select]').forEach((item) => {
    item.querySelector('.custom-select-menu').hidden = true;
    item.querySelector('[data-sort-toggle]').setAttribute('aria-expanded', 'false');
  });

  const windowControl = event.target.closest('[data-window-control]');
  if (windowControl) {
    const control = windowControl.dataset.windowControl;
    if (control === 'minimize') window.vortexDesktop?.minimizeWindow?.();
    if (control === 'maximize') window.vortexDesktop?.toggleMaximizeWindow?.();
    if (control === 'close') window.vortexDesktop?.closeWindow?.();
    return;
  }

  const nav = event.target.closest('[data-nav]');
  if (nav) { setView(nav.dataset.nav); return; }

  const action = event.target.closest('[data-action]');
  if (action) {
    if (action.dataset.action === 'favorite') toggleFavorite(action.dataset.id);
    if (action.dataset.action === 'play') openGame(action.dataset.id);
    if (action.dataset.action === 'toggle-description') {
      const id = String(action.dataset.id);
      if (expandedDescriptions.has(id)) expandedDescriptions.delete(id);
      else expandedDescriptions.add(id);
      renderPage();
    }
    if (action.dataset.action === 'load-more') {
      if (searchQuery.length >= 2) fetchLiveSearch(true);
      else { catalogVisibleCount += CATALOG_PAGE_SIZE; renderPage(); }
    }
    if (action.dataset.action === 'notifications') showToast(t('toast.notifications'));
    if (action.dataset.action === 'open-update-installer') {
      window.vortexDesktop?.openDownloadedUpdate?.().catch(() => showToast(t('updates.openError')));
    }
    if (action.dataset.action === 'clear-cache') {
      Object.keys(localStorage).filter((key) => key.startsWith(SEARCH_CACHE_PREFIX)).forEach((key) => localStorage.removeItem(key));
      localStorage.removeItem('vortex.featuredCache');
      localStorage.removeItem('vortex.discoveryCatalog');
      discoveryCatalog = {};
      discoveryStatus = 'idle';
      window.vortexDesktop?.clearSearchCache?.();
      showToast(t('settings.cacheCleared'));
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
      savePreferences();
      renderPage();
    }
    return;
  }

  const category = event.target.closest('[data-category]');
  if (category) { activeCategory = category.dataset.category; renderPage(); return; }

  const discoverySort = event.target.closest('[data-discovery-sort]');
  if (discoverySort) { loadDiscoveryCatalog(discoverySort.dataset.discoverySort); return; }

  const tab = event.target.closest('[data-settings-tab]');
  if (tab) { preferences.settingsTab = tab.dataset.settingsTab; savePreferences(); renderPage(); return; }

  const accent = event.target.closest('[data-accent]');
  if (accent) { preferences.accent = accent.dataset.accent; savePreferences(); renderPage(); return; }

  const featuredGame = event.target.closest('[data-home-featured]');
  if (featuredGame) { preferences.homeFeaturedGame = featuredGame.dataset.homeFeatured; savePreferences(); renderPage(); return; }

  const segment = event.target.closest('[data-pref]');
  if (segment) {
    preferences[segment.dataset.pref] = segment.dataset.value;
    savePreferences();
    renderPage();
    if (segment.dataset.pref === 'language') showToast(t('settings.languageUpdated'));
  }

  const toggle = event.target.closest('[data-toggle]');
  if (toggle) { preferences[toggle.dataset.toggle] = !preferences[toggle.dataset.toggle]; savePreferences(); renderPage(); }
});

document.addEventListener('input', (event) => {
  if (event.target === searchInput) {
    scheduleLiveSearch(searchInput.value);
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
    preferences[name] = hslToHex(value('hue'), value('saturation'), value('lightness'));
    savePreferences();
    applyPreferences();
    syncColorTuner(name, preferences[name]);
    if (name === 'accent') document.querySelectorAll('.palette-option').forEach((button) => button.classList.toggle('active', button.dataset.accent === preferences.accent));
    return;
  }
  if (event.target.matches('[data-home-greeting]')) {
    preferences.homeGreeting = event.target.value.slice(0, 48);
    savePreferences();
    return;
  }
  if (event.target.matches('[data-setting="glow"]')) {
    preferences.glow = Number(event.target.value);
    savePreferences();
    applyPreferences();
    const value = document.getElementById('glow-value');
    if (value) value.textContent = `${preferences.glow}%`;
    return;
  }
  if (event.target.matches('[data-setting="gradientAngle"]')) {
    preferences.gradientAngle = Number(event.target.value);
    savePreferences();
    applyPreferences();
    const value = document.getElementById('gradient-angle-value');
    if (value) value.textContent = `${preferences.gradientAngle}°`;
  }
});

function syncColorTuner(name, color) {
  const tuner = pageContent.querySelector(`[data-color-tuner="${name}"]`);
  if (!tuner) return;
  const hsl = rgbToHsl(color);
  const hex = tuner.querySelector(`[data-color-hex="${name}"]`);
  if (hex) { hex.value = color.toUpperCase(); hex.setAttribute('aria-invalid', 'false'); }
  tuner.querySelector('.color-preview')?.style.setProperty('--sample-color', color);
  for (const [axis, suffix] of [['hue', '°'], ['saturation', '%'], ['lightness', '%']]) {
    const input = tuner.querySelector(`[data-color-axis="${axis}"]`);
    const output = tuner.querySelector(`[data-color-value="${axis}"]`);
    if (input) input.value = hsl[axis];
    if (output) output.value = `${hsl[axis]}${suffix}`;
  }
}

document.addEventListener('dblclick', (event) => {
  if (event.target.closest('[data-window-drag]')) window.vortexDesktop?.toggleMaximizeWindow?.();
});

document.addEventListener('keydown', (event) => {
  const isTyping = event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName));
  const openMenu = document.querySelector('[data-custom-select] .custom-select-menu:not([hidden])');
  if (event.key === 'Escape' && openMenu) {
    event.preventDefault();
    openMenu.hidden = true;
    const trigger = openMenu.closest('[data-custom-select]').querySelector('[data-sort-toggle]');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' || (event.key === '/' && !isTyping)) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === 'Escape' && document.activeElement === searchInput) {
    searchInput.value = '';
    scheduleLiveSearch('');
    searchInput.blur();
  }
});

mountIcons();
applyPreferences();
renderPage();
window.vortexDesktop?.onWindowState?.(({ isMaximized }) => setWindowMaximized(Boolean(isMaximized)));
window.vortexDesktop?.onUpdateState?.(renderUpdateBanner);
window.vortexDesktop?.getUpdateState?.().then(renderUpdateBanner).catch(() => {});
hydrateFeaturedGames();
loadDiscoveryCatalog(activeDiscoverySort);
