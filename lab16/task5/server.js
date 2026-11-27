const express = require('express');
const swaggerUi = require('swagger-ui-express');
const multer = require('multer');
const { db, GROUP } = require('./data');
const auth = require('./auth');
const booksRouter = require('./books');
const adminRouter = require('./admin');
const swaggerDoc = require('./swagger');

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - start}ms`);
  });
  next();
});

app.get('/', (req, res) => {
  res.json({
    message: 'Library API, лабораторная работа №16, задание 5',
    docs: '/api-docs',
    books: db.books.length
  });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
app.get('/api-docs.json', (req, res) => res.json(swaggerDoc));

app.use('/auth', auth.router);
app.use('/api/books', auth.authenticate, booksRouter);
app.use('/api/admin', auth.authenticate, auth.requireRole('admin'), adminRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Маршрут не найден', status: 404 });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Некорректный JSON в теле запроса', status: 400 });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Ошибка загрузки файла: ${err.message}`, status: 400 });
  }
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера', status: 500 });
});

app.listen(PORT, () => {
  const available = db.books.filter((b) => b.available > 0).length;
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log(`Документация: http://localhost:${PORT}/api-docs`);
  console.log(`Сгенерировано книг: ${db.books.length} (зерно ${GROUP}), в наличии: ${available}`);
});
