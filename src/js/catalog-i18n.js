const catalogLabels = [
  ['collections', 'Подборки', 'Collections'],
  ['searchPlaceholder', 'Название, Place ID или ссылка', 'Name, Place ID, or link'],
  ['allGenres', 'Все', 'All'],
  ['onlyFriends', 'Только с друзьями', 'Only with friends'],
  ['game', 'Игра', 'Game'],
  ['players', 'Играют', 'Playing'],
  ['day', 'За сутки', '24h change'],
  ['sinceRefresh', 'С обновления', 'Since refresh'],
  ['rankChange', 'Позиция', 'Rank change'],
  ['dayComparison', 'За сутки · сравнение с {time}', '24h change · compared with {time}'],
  ['lastComparison', 'С прошлого обновления · {time}', 'Since the previous refresh · {time}'],
  ['rankHistoryEmpty', 'Изменение позиций появится после следующего обновления чарта.', 'Rank changes will appear after the next chart refresh.'],
  ['newInChart', 'В чарте', 'Entered'],
  ['newInChartHint', 'Игры не было в подборке на момент сравнения.', 'This game was outside the chart at the time of comparison.'],
  ['rating', 'Оценка', 'Rating'],
  ['actions', 'Действия', 'Actions'],
  ['friendsPlaying', 'Друзей в игре: {count}', '{count} friends playing'],
  ['friendsSetup', 'Подключи Roblox', 'Connect Roblox'],
  ['friendsSetupHint', 'Укажи аккаунт Roblox, чтобы увидеть игры друзей.', 'Add your Roblox account to see what friends are playing.'],
  ['friendsError', 'Не удалось обновить статусы', 'Could not refresh friend activity'],
  ['noFriendsFound', 'Друзей в этих играх не видно', 'No visible friends in these games'],
  ['noFriendsFoundHint', 'Попробуй другую подборку или отключи фильтр.', 'Try another collection or clear the filter.'],
  ['friendLeft', 'Сервер друга больше не виден', 'This friend’s server is no longer visible'],
  ['rise', 'Выше на {count}', 'Up {count} places'],
  ['fall', 'Ниже на {count}', 'Down {count} places'],
  ['updatedAt', 'Обновлено в {time}', 'Updated {time}'],
  ['refresh', 'Обновить чарт', 'Refresh chart'],
  ['exploreGenre', 'Найти больше игр этого жанра', 'Find more games in this genre'],
  ['topPick', 'Рекомендация для тебя', 'Recommended for you'],
  ['discoverPick', 'Попробуй новую игру', 'Try something new'],
  ['friendsShelf', 'Играют твои друзья', 'Your friends are playing'],
  ['moreGames', 'Ещё для тебя', 'More for you'],
  ['match', 'Совпадение {count}%', '{count}% match'],
  ['matchHint', 'Оценка сходства по интересам в Vortex', 'Similarity score based on your interests in Vortex'],
  ['becauseHours', 'Ты провёл {time} в игре «{game}».', 'You spent {time} playing “{game}”.'],
  ['becauseGenre', 'По твоим интересам: {game}', 'From your interests: {game}'],
  ['feedback', 'Действия с рекомендацией', 'Recommendation actions'],
  ['recommendationSettings', 'Настроить рекомендации', 'Tune recommendations'],
  ['interests', 'Любимые жанры', 'Favorite genres'],
  ['hiddenGames', 'Скрытые игры', 'Hidden games'],
  ['noHiddenGames', 'Скрытых игр пока нет.', 'No hidden games yet.'],
  ['restoreHint', 'Отметь игры, которые хочешь снова видеть в рекомендациях.', 'Select the games you want to see in recommendations again.'],
  ['noRecommendations', 'Попробуй выбрать любимые жанры или загрузить ещё игры.', 'Choose your favorite genres or try loading more games.'],
  ['continueSearching', 'В этой порции новых игр не нашлось. Можно продолжить поиск.', 'This batch had no new games. You can keep looking.']
];
for (const [key, ru, en] of catalogLabels) {
  translations.ru['chart.' + key] = ru;
  translations.en['chart.' + key] = en;
}
const catalogCollectionLabels = [
  ['recommended', 'Для вас', 'For you'],
  ['top-rated', 'Лучшие по оценкам', 'Top rated'],
  ['like-percentage', 'По % лайков', 'Like percentage'],
  ['up-and-coming', 'Растущие', 'Up-and-coming'],
  ['top-revisited', 'Возвращаются', 'Top revisited'],
  ['fun-with-friends', 'Весело с друзьями', 'Fun with friends']
];
for (const [id, ru, en] of catalogCollectionLabels) {
  translations.ru['catalog.sort.' + id] = ru;
  translations.en['catalog.sort.' + id] = en;
}
