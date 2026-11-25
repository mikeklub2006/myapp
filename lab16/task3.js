const express = require('express');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const PORT = process.env.PORT || 3000;
const app = express();

let books = [
  { id: 1, title: 'Война и мир', author: 'Толстой', year: 1869 },
  { id: 2, title: 'Анна Каренина', author: 'Толстой', year: 1877 },
  { id: 3, title: 'Преступление и наказание', author: 'Достоевский', year: 1866 },
  { id: 4, title: 'Идиот', author: 'Достоевский', year: 1869 },
  { id: 5, title: 'Мастер и Маргарита', author: 'Булгаков', year: 1967 },
  { id: 6, title: 'Собачье сердце', author: 'Булгаков', year: 1925 },
  { id: 7, title: 'Отцы и дети', author: 'Тургенев', year: 1862 },
  { id: 8, title: 'Евгений Онегин', author: 'Пушкин', year: 1833 },
  { id: 9, title: 'Мертвые души', author: 'Гоголь', year: 1842 },
  { id: 10, title: 'Герой нашего времени', author: 'Лермонтов', year: 1840 }
];
let nextId = 11;

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

function logger(req, res, next) {
  const start = new Date();
  res.on('finish', () => {
    const ms = Date.now() - start.getTime();
    console.log(`[${formatDate(start)}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${ms}ms`);
  });
  next();
}

// express 4 сам не ловит ошибки из async-функций, поэтому оборачиваем
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function validateBook(data, partial) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpError(400, 'Тело запроса должно быть JSON-объектом');
  }
  if (partial && data.title === undefined && data.author === undefined && data.year === undefined) {
    throw new HttpError(400, 'Нужно передать хотя бы одно поле: title, author, year');
  }
  if ((!partial || data.title !== undefined) && (typeof data.title !== 'string' || !data.title.trim())) {
    throw new HttpError(400, 'Поле title обязательно и не может быть пустым');
  }
  if ((!partial || data.author !== undefined) && (typeof data.author !== 'string' || !data.author.trim())) {
    throw new HttpError(400, 'Поле author обязательно и не может быть пустым');
  }
  const maxYear = new Date().getFullYear();
  if ((!partial || data.year !== undefined) && (!Number.isInteger(data.year) || data.year < 0 || data.year > maxYear)) {
    throw new HttpError(400, `Поле year должно быть целым числом от 0 до ${maxYear}`);
  }
}

function findBook(id) {
  const book = books.find((b) => b.id === Number(id));
  if (!book) throw new HttpError(404, 'Книга не найдена');
  return book;
}

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-6',
  legacyHeaders: true,
  handler: (req, res, next, options) => {
    res.status(429).json({
      error: 'Слишком много запросов, попробуйте через минуту',
      status: 429,
      limit: options.limit
    });
  }
});

app.use(logger);
app.use(limiter);
app.use(compression({ threshold: 512 }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Лабораторная работа №16, задание 3',
    routes: ['GET /api/books', 'GET /api/books/:id', 'POST /api/books', 'PUT /api/books/:id',
      'DELETE /api/books/:id', 'GET /error', 'GET /async-error']
  });
});

app.get('/api/books', (req, res) => {
  res.json(books);
});

app.get('/api/books/:id', (req, res) => {
  res.json(findBook(req.params.id));
});

app.post('/api/books', (req, res) => {
  validateBook(req.body, false);
  const book = {
    id: nextId++,
    title: req.body.title.trim(),
    author: req.body.author.trim(),
    year: req.body.year
  };
  books.push(book);
  res.status(201).json(book);
});

app.put('/api/books/:id', (req, res) => {
  const book = findBook(req.params.id);
  validateBook(req.body, true);
  if (req.body.title !== undefined) book.title = req.body.title.trim();
  if (req.body.author !== undefined) book.author = req.body.author.trim();
  if (req.body.year !== undefined) book.year = req.body.year;
  res.json(book);
});

app.delete('/api/books/:id', (req, res) => {
  const book = findBook(req.params.id);
  books = books.filter((b) => b.id !== book.id);
  res.json({ message: `Книга "${book.title}" удалена`, id: book.id });
});

app.get('/error', () => {
  throw new Error('Синхронная тестовая ошибка');
});

app.get('/async-error', asyncHandler(async () => {
  await new Promise((resolve) => setTimeout(resolve, 50));
  throw new Error('Асинхронная тестовая ошибка');
}));

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
    console.error(`Ошибка: ${err.message}`);
    message = 'Внутренняя ошибка сервера';
  }
  res.status(status).json({ error: message, status });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
