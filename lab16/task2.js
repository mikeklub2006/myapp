const express = require('express');

const PORT = process.env.PORT || 3000;
const app = express();

let books = [
  { id: 1, title: 'Война и мир', author: 'Толстой', year: 1869 },
  { id: 2, title: 'Анна Каренина', author: 'Толстой', year: 1877 },
  { id: 3, title: 'Преступление и наказание', author: 'Достоевский', year: 1866 },
  { id: 4, title: 'Мастер и Маргарита', author: 'Булгаков', year: 1967 },
  { id: 5, title: 'Отцы и дети', author: 'Тургенев', year: 1862 }
];
let nextId = 6;

function validateBook(data, partial) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'Тело запроса должно быть JSON-объектом';
  }
  if (partial && data.title === undefined && data.author === undefined && data.year === undefined) {
    return 'Нужно передать хотя бы одно поле: title, author, year';
  }
  if ((!partial || data.title !== undefined) && (typeof data.title !== 'string' || !data.title.trim())) {
    return 'Поле title обязательно и не может быть пустым';
  }
  if ((!partial || data.author !== undefined) && (typeof data.author !== 'string' || !data.author.trim())) {
    return 'Поле author обязательно и не может быть пустым';
  }
  const maxYear = new Date().getFullYear();
  if ((!partial || data.year !== undefined) && (!Number.isInteger(data.year) || data.year < 0 || data.year > maxYear)) {
    return `Поле year должно быть целым числом от 0 до ${maxYear}`;
  }
  return null;
}

function findBook(req, res) {
  const book = books.find((b) => b.id === Number(req.params.id));
  if (!book) {
    res.status(404).json({ error: 'Книга не найдена', status: 404 });
    return null;
  }
  return book;
}

app.use(express.json());

app.get('/api/books', (req, res) => {
  res.json(books);
});

// search должен стоять раньше /:id, иначе "search" примется за id
app.get('/api/books/search', (req, res) => {
  const author = (req.query.author || '').trim().toLowerCase();
  if (!author) {
    return res.status(400).json({ error: 'Укажите параметр author', status: 400 });
  }
  res.json(books.filter((b) => b.author.toLowerCase().includes(author)));
});

app.get('/api/books/:id', (req, res) => {
  const book = findBook(req, res);
  if (book) res.json(book);
});

app.post('/api/books', (req, res) => {
  const error = validateBook(req.body, false);
  if (error) return res.status(400).json({ error, status: 400 });

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
  const book = findBook(req, res);
  if (!book) return;

  const error = validateBook(req.body, true);
  if (error) return res.status(400).json({ error, status: 400 });

  if (req.body.title !== undefined) book.title = req.body.title.trim();
  if (req.body.author !== undefined) book.author = req.body.author.trim();
  if (req.body.year !== undefined) book.year = req.body.year;
  res.json(book);
});

app.delete('/api/books/:id', (req, res) => {
  const book = findBook(req, res);
  if (!book) return;

  books = books.filter((b) => b.id !== book.id);
  res.json({ message: `Книга "${book.title}" удалена`, id: book.id });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Маршрут не найден', status: 404 });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Некорректный JSON в теле запроса', status: 400 });
  }
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера', status: 500 });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log('API книг: /api/books');
});
