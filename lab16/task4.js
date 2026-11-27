const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, 'operations.log');
const app = express();

let books = [
  { id: 1, title: 'Война и мир', author: 'Толстой', year: 1869, genre: 'роман' },
  { id: 2, title: 'Анна Каренина', author: 'Толстой', year: 1877, genre: 'роман' },
  { id: 3, title: 'Детство', author: 'Толстой', year: 1852, genre: 'повесть' },
  { id: 4, title: 'Преступление и наказание', author: 'Достоевский', year: 1866, genre: 'роман' },
  { id: 5, title: 'Белые ночи', author: 'Достоевский', year: 1848, genre: 'повесть' },
  { id: 6, title: 'Мастер и Маргарита', author: 'Булгаков', year: 1967, genre: 'роман' },
  { id: 7, title: 'Собачье сердце', author: 'Булгаков', year: 1925, genre: 'повесть' },
  { id: 8, title: 'Евгений Онегин', author: 'Пушкин', year: 1833, genre: 'поэма' },
  { id: 9, title: 'Капитанская дочка', author: 'Пушкин', year: 1836, genre: 'роман' },
  { id: 10, title: 'Мертвые души', author: 'Гоголь', year: 1842, genre: 'поэма' },
  { id: 11, title: 'Ревизор', author: 'Гоголь', year: 1836, genre: 'пьеса' },
  { id: 12, title: 'Вишневый сад', author: 'Чехов', year: 1904, genre: 'пьеса' },
  { id: 13, title: 'Война миров', author: 'Уэллс', year: 1897, genre: 'фантастика' },
  { id: 14, title: 'Пикник на обочине', author: 'Стругацкие', year: 1972, genre: 'фантастика' },
  { id: 15, title: 'Тихий Дон', author: 'Шолохов', year: 1940, genre: 'роман' }
];
let nextId = 16;

const SORT_FIELDS = ['id', 'title', 'author', 'year', 'genre'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const d = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const t = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${d} ${t}`;
}

// пишем синхронно, чтобы строки в файле шли в том же порядке, что и операции
function writeLog(line) {
  try {
    fs.appendFileSync(LOG_FILE, `[${formatDate(new Date())}] ${line}\n`, 'utf8');
  } catch (err) {
    console.error('Не удалось записать лог:', err.message);
  }
}

function toInt(value, name, min) {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) throw new HttpError(400, `${name} должен быть целым числом не меньше ${min}`);
  return n;
}

function normalize(str) {
  return String(str).trim().toLowerCase();
}

function validateBook(data, partial) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpError(400, 'Тело запроса должно быть JSON-объектом');
  }
  const fields = ['title', 'author', 'year', 'genre'];
  if (partial && !fields.some((f) => data[f] !== undefined)) {
    throw new HttpError(400, 'Нужно передать хотя бы одно поле: ' + fields.join(', '));
  }

  const errors = [];
  if ((!partial || data.title !== undefined) && (typeof data.title !== 'string' || !data.title.trim())) {
    errors.push('название не должно быть пустым');
  }
  if ((!partial || data.author !== undefined) && (typeof data.author !== 'string' || !data.author.trim())) {
    errors.push('автор не должен быть пустым');
  }
  const maxYear = new Date().getFullYear();
  if ((!partial || data.year !== undefined) && (!Number.isInteger(data.year) || data.year < 1 || data.year > maxYear)) {
    errors.push(`год должен быть целым числом от 1 до ${maxYear}`);
  }
  if (data.genre !== undefined && (typeof data.genre !== 'string' || !data.genre.trim())) {
    errors.push('жанр должен быть непустой строкой');
  }
  if (errors.length) throw new HttpError(400, 'Ошибка валидации: ' + errors.join('; '));
}

function checkDuplicate(title, author, exceptId) {
  const dup = books.find((b) => b.id !== exceptId &&
    normalize(b.title) === normalize(title) && normalize(b.author) === normalize(author));
  if (dup) throw new HttpError(409, `Книга "${dup.title}" автора ${dup.author} уже есть (id ${dup.id})`);
}

function findBook(id) {
  const book = books.find((b) => b.id === Number(id));
  if (!book) throw new HttpError(404, 'Книга не найдена');
  return book;
}

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - start}ms`;
    console.log(line);
    writeLog(line);
  });
  next();
});

app.get('/api/books', (req, res) => {
  const { author, search, sort } = req.query;
  const year = toInt(req.query.year, 'year', 0);
  const yearFrom = toInt(req.query.yearFrom, 'yearFrom', 0);
  const yearTo = toInt(req.query.yearTo, 'yearTo', 0);
  const limit = toInt(req.query.limit, 'limit', 1) || 10;
  const page = toInt(req.query.page, 'page', 1) || 1;

  let list = books.slice();

  if (author) list = list.filter((b) => normalize(b.author).includes(normalize(author)));
  if (req.query.genre) list = list.filter((b) => normalize(b.genre || '') === normalize(req.query.genre));
  if (year !== undefined) list = list.filter((b) => b.year === year);
  if (yearFrom !== undefined) list = list.filter((b) => b.year >= yearFrom);
  if (yearTo !== undefined) list = list.filter((b) => b.year <= yearTo);
  if (search) {
    const text = normalize(search);
    list = list.filter((b) => normalize(b.title).includes(text) || normalize(b.author).includes(text));
  }

  if (sort) {
    const desc = sort.startsWith('-');
    const field = desc ? sort.slice(1) : sort;
    if (!SORT_FIELDS.includes(field)) {
      throw new HttpError(400, `Сортировка возможна по полям: ${SORT_FIELDS.join(', ')}`);
    }
    list.sort((a, b) => {
      const res = typeof a[field] === 'number'
        ? a[field] - b[field]
        : String(a[field] || '').localeCompare(String(b[field] || ''), 'ru');
      return desc ? -res : res;
    });
  }

  const total = list.length;
  res.json({
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    data: list.slice((page - 1) * limit, page * limit)
  });
});

app.get('/api/books/stats', (req, res) => {
  const byAuthor = {};
  const byGenre = {};
  for (const book of books) {
    byAuthor[book.author] = (byAuthor[book.author] || 0) + 1;
    const genre = book.genre || 'не указан';
    byGenre[genre] = (byGenre[genre] || 0) + 1;
  }
  const years = books.map((b) => b.year);

  res.json({
    total: books.length,
    byAuthor,
    byGenre,
    oldestYear: years.length ? Math.min(...years) : null,
    newestYear: years.length ? Math.max(...years) : null
  });
});

app.get('/api/books/:id', (req, res) => {
  res.json(findBook(req.params.id));
});

app.post('/api/books', (req, res) => {
  validateBook(req.body, false);
  checkDuplicate(req.body.title, req.body.author);

  const book = {
    id: nextId++,
    title: req.body.title.trim(),
    author: req.body.author.trim(),
    year: req.body.year,
    genre: req.body.genre ? req.body.genre.trim() : 'не указан'
  };
  books.push(book);
  writeLog(`CREATE id=${book.id} "${book.title}" (${book.author}, ${book.year})`);
  res.status(201).json(book);
});

app.put('/api/books/:id', (req, res) => {
  const book = findBook(req.params.id);
  validateBook(req.body, true);

  const updated = { ...book };
  for (const field of ['title', 'author', 'genre']) {
    if (req.body[field] !== undefined) updated[field] = req.body[field].trim();
  }
  if (req.body.year !== undefined) updated.year = req.body.year;
  checkDuplicate(updated.title, updated.author, book.id);

  Object.assign(book, updated);
  writeLog(`UPDATE id=${book.id} ${JSON.stringify(req.body)}`);
  res.json(book);
});

app.delete('/api/books/:id', (req, res) => {
  const book = findBook(req.params.id);
  books = books.filter((b) => b.id !== book.id);
  writeLog(`DELETE id=${book.id} "${book.title}"`);
  res.json({ message: `Книга "${book.title}" удалена`, deleted: book });
});

app.use((req, res, next) => {
  next(new HttpError(404, 'Маршрут не найден'));
});

app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message;
  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Некорректный JSON в теле запроса';
  } else if (status === 500) {
    console.error(err);
    message = 'Внутренняя ошибка сервера';
  }
  writeLog(`ERROR ${status} ${req.method} ${req.originalUrl}: ${message}`);
  res.status(status).json({ error: message, status });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log(`Лог операций: ${LOG_FILE}`);
  writeLog(`START сервер запущен, книг: ${books.length}`);
});
