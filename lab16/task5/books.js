const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { db } = require('./data');
const { schemas, validate } = require('./validation');
const { requireRole } = require('./auth');
const { cache, clearCache } = require('./cache');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });

const CSV_FIELDS = ['id', 'title', 'author', 'year', 'genre', 'isbn', 'pages', 'copies', 'available'];

function rating(book) {
  if (!book.reviews.length) return null;
  const sum = book.reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / book.reviews.length) * 10) / 10;
}

function short(book) {
  const { reviews, ...rest } = book;
  return { ...rest, rating: rating(book), reviewsCount: reviews.length };
}

function normalizeIsbn(isbn) {
  return isbn.replace(/[-\s]/g, '').toUpperCase();
}

function findDuplicate(data, exceptId) {
  return db.books.find((b) => b.id !== exceptId && (
    normalizeIsbn(b.isbn) === normalizeIsbn(data.isbn) ||
    (b.title.toLowerCase() === data.title.toLowerCase() && b.author.toLowerCase() === data.author.toLowerCase())
  ));
}

function getBook(req, res) {
  const book = db.books.find((b) => b.id === Number(req.params.id));
  if (!book) res.status(404).json({ error: 'Книга не найдена', status: 404 });
  return book;
}

function csvValue(value) {
  const str = value === undefined || value === null ? '' : String(value);
  return /[",\n;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

router.get('/', validate(schemas.bookQuery, 'query'), cache, (req, res) => {
  const q = req.query;
  let list = db.books.slice();

  if (q.author) list = list.filter((b) => b.author.toLowerCase().includes(q.author.toLowerCase()));
  if (q.genre) list = list.filter((b) => b.genre === q.genre);
  if (q.year !== undefined) list = list.filter((b) => b.year === q.year);
  if (q.yearFrom !== undefined) list = list.filter((b) => b.year >= q.yearFrom);
  if (q.yearTo !== undefined) list = list.filter((b) => b.year <= q.yearTo);
  if (q.available !== undefined) list = list.filter((b) => (b.available > 0) === q.available);
  if (q.search) {
    const text = q.search.toLowerCase();
    list = list.filter((b) => b.title.toLowerCase().includes(text) || b.author.toLowerCase().includes(text));
  }

  let result = list.map(short);
  if (q.sort) {
    const desc = q.sort.startsWith('-');
    const field = desc ? q.sort.slice(1) : q.sort;
    result.sort((a, b) => {
      const x = a[field];
      const y = b[field];
      // книги без рейтинга всегда в конце
      if (x === null || y === null) return (x === null) - (y === null);
      const cmp = typeof x === 'string' ? x.localeCompare(y, 'ru') : x - y;
      return desc ? -cmp : cmp;
    });
  }

  const start = (q.page - 1) * q.limit;
  res.json({
    total: result.length,
    page: q.page,
    limit: q.limit,
    pages: Math.ceil(result.length / q.limit),
    data: result.slice(start, start + q.limit)
  });
});

router.get('/export', (req, res) => {
  const format = (req.query.format || 'json').toLowerCase();

  if (format === 'json') {
    res.attachment('books.json');
    return res.send(JSON.stringify(db.books.map(short), null, 2));
  }
  if (format === 'csv') {
    const lines = [CSV_FIELDS.join(',')];
    for (const book of db.books) {
      lines.push(CSV_FIELDS.map((f) => csvValue(book[f])).join(','));
    }
    res.attachment('books.csv');
    res.type('text/csv; charset=utf-8');
    // BOM, чтобы excel открыл кириллицу нормально
    return res.send('﻿' + lines.join('\n'));
  }
  res.status(400).json({ error: 'format должен быть csv или json', status: 400 });
});

router.post('/import', requireRole('admin'), upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Прикрепите CSV-файл в поле file (multipart/form-data)', status: 400 });
  }

  let rows;
  try {
    rows = parse(req.file.buffer.toString('utf8'), { columns: true, skip_empty_lines: true, trim: true, bom: true });
  } catch (err) {
    return res.status(400).json({ error: `Не удалось разобрать CSV: ${err.message}`, status: 400 });
  }

  const imported = [];
  const skipped = [];
  rows.forEach((row, i) => {
    const line = i + 2;
    const data = {};
    for (const [key, value] of Object.entries(row)) {
      if (key !== 'id' && value !== '') data[key] = value;
    }

    const { error, value } = schemas.bookCreate.validate(data, { abortEarly: false, stripUnknown: true });
    if (error) {
      skipped.push({ line, reason: error.details.map((d) => d.message).join('; ') });
      return;
    }
    if (findDuplicate(value)) {
      skipped.push({ line, reason: 'такая книга уже есть (ISBN или название + автор)' });
      return;
    }

    const book = {
      id: db.nextBookId++,
      ...value,
      available: value.available === undefined ? value.copies : value.available,
      reviews: []
    };
    db.books.push(book);
    imported.push(book.id);
  });

  if (imported.length) clearCache();
  res.status(imported.length ? 201 : 200).json({
    message: `Импортировано книг: ${imported.length}, пропущено: ${skipped.length}`,
    imported,
    skipped
  });
});

router.get('/recommendations', cache, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 5, 20);
  let genres;
  let basedOn;

  if (req.query.genre) {
    genres = [String(req.query.genre).toLowerCase()];
    basedOn = 'жанр из запроса';
  } else {
    const reviewed = db.books.filter((b) => b.reviews.some((r) => r.userId === req.user.id));
    genres = [...new Set(reviewed.map((b) => b.genre))];
    basedOn = 'жанры книг, на которые вы оставляли отзывы';

    if (!genres.length) {
      const counts = {};
      for (const b of db.books) counts[b.genre] = (counts[b.genre] || 0) + 1;
      genres = [Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0]];
      basedOn = 'самый популярный жанр в библиотеке';
    }
  }

  const reviewedIds = new Set(db.books.filter((b) => b.reviews.some((r) => r.userId === req.user.id)).map((b) => b.id));
  const data = db.books
    .filter((b) => genres.includes(b.genre) && b.available > 0 && !reviewedIds.has(b.id))
    .map(short)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0) || b.year - a.year)
    .slice(0, limit);

  res.json({ basedOn, genres, count: data.length, data });
});

router.get('/available', cache, (req, res) => {
  const data = db.books.filter((b) => b.available > 0).map(short);
  res.json({ total: data.length, data });
});

router.get('/:id', cache, (req, res) => {
  const book = getBook(req, res);
  if (!book) return;
  res.json({ ...short(book), reviews: book.reviews });
});

router.post('/', requireRole('admin'), validate(schemas.bookCreate), (req, res) => {
  const dup = findDuplicate(req.body);
  if (dup) {
    return res.status(409).json({ error: `Книга уже есть в библиотеке (id ${dup.id})`, status: 409 });
  }

  const book = {
    id: db.nextBookId++,
    ...req.body,
    available: req.body.available === undefined ? req.body.copies : req.body.available,
    reviews: []
  };
  db.books.push(book);
  clearCache();
  res.status(201).json(short(book));
});

router.put('/:id', validate(schemas.bookUpdate), (req, res) => {
  const book = getBook(req, res);
  if (!book) return;

  const updated = { ...book, ...req.body };
  if (updated.available > updated.copies) {
    return res.status(400).json({ error: 'available не может быть больше copies', status: 400 });
  }
  const dup = findDuplicate(updated, book.id);
  if (dup) {
    return res.status(409).json({ error: `Конфликт с книгой id ${dup.id} (ISBN или название + автор)`, status: 409 });
  }

  Object.assign(book, req.body);
  clearCache();
  res.json(short(book));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const book = getBook(req, res);
  if (!book) return;

  db.books = db.books.filter((b) => b.id !== book.id);
  clearCache();
  res.json({ message: `Книга "${book.title}" удалена`, id: book.id });
});

router.post('/:id/reviews', validate(schemas.review), (req, res) => {
  const book = getBook(req, res);
  if (!book) return;

  if (book.reviews.some((r) => r.userId === req.user.id)) {
    return res.status(409).json({ error: 'Вы уже оставили отзыв на эту книгу', status: 409 });
  }

  const review = {
    id: db.nextReviewId++,
    userId: req.user.id,
    userName: req.user.name,
    rating: req.body.rating,
    text: req.body.text,
    createdAt: new Date().toISOString()
  };
  book.reviews.push(review);
  clearCache();
  res.status(201).json({ review, bookRating: rating(book) });
});

module.exports = router;
