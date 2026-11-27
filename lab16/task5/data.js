const bcrypt = require('bcryptjs');

const GROUP = 401;
const BOOKS_COUNT = 100;

const GENRES = ['роман', 'детектив', 'фантастика', 'фэнтези', 'приключения', 'поэзия',
  'драма', 'научпоп', 'история', 'психология'];

const firstWords = ['Тайна', 'Тень', 'Хроники', 'Последний день', 'Дорога', 'Песня', 'Легенда',
  'Возвращение', 'Сердце', 'Свет', 'Пленник', 'Хранитель'];
const secondWords = ['старого маяка', 'северного ветра', 'забытого города', 'белой реки',
  'ночного поезда', 'далекой звезды', 'серого замка', 'тихой гавани', 'лунного острова',
  'последнего лета', 'горного перевала', 'пустого дома', 'зимнего сада'];

const initials = ['А.', 'Б.', 'В.', 'Г.', 'Д.', 'Е.', 'И.', 'К.', 'Л.', 'М.', 'Н.', 'О.', 'П.', 'С.', 'Т.'];
const surnames = ['Ковалев', 'Белов', 'Орлова', 'Громов', 'Савельева', 'Зайцев', 'Лебедев',
  'Мельникова', 'Тихонов', 'Воронцова', 'Крылов', 'Соболев', 'Ветрова', 'Яковлев',
  'Миронова', 'Фролов', 'Демидов', 'Полякова', 'Рябов', 'Дорохова'];

// mulberry32 - простой генератор с зерном, зерно берем из номера группы
function createRandom(seed) {
  let state = seed >>> 0;
  return function () {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

function isbn13CheckDigit(first12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

// 978-5 - российские издания, 401 - код "издательства" по номеру группы
function makeIsbn(number) {
  const body = `9785${GROUP}${String(number).padStart(5, '0')}`;
  const digit = isbn13CheckDigit(body);
  return `978-5-${GROUP}-${body.slice(7)}-${digit}`;
}

function generateBooks(count) {
  const random = createRandom(GROUP);
  const authors = [];
  while (authors.length < 25) {
    const name = `${pick(random, initials)} ${pick(random, surnames)}`;
    if (!authors.includes(name)) authors.push(name);
  }

  const books = [];
  const usedTitles = new Set();
  const usedNumbers = new Set();

  for (let id = 1; id <= count; id++) {
    let title;
    do {
      title = `${pick(random, firstWords)} ${pick(random, secondWords)}`;
    } while (usedTitles.has(title));
    usedTitles.add(title);

    let number;
    do {
      number = randomInt(random, 1, 99999);
    } while (usedNumbers.has(number));
    usedNumbers.add(number);

    const copies = randomInt(random, 1, 5);
    books.push({
      id,
      title,
      author: pick(random, authors),
      year: randomInt(random, 1950, 2024),
      genre: pick(random, GENRES),
      isbn: makeIsbn(number),
      pages: randomInt(random, 120, 800),
      copies,
      // примерно у пятой части книг все экземпляры на руках
      available: random() < 0.2 ? 0 : randomInt(random, 1, copies),
      reviews: []
    });
  }
  return books;
}

const db = {
  books: generateBooks(BOOKS_COUNT),
  users: [],
  nextBookId: BOOKS_COUNT + 1,
  nextUserId: 1,
  nextReviewId: 1
};

db.users.push({
  id: db.nextUserId++,
  email: process.env.ADMIN_EMAIL || 'admin@library.local',
  name: 'Администратор',
  passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin401', 10),
  role: 'admin'
});

module.exports = { db, GENRES, GROUP };
