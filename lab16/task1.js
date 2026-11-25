const express = require('express');

const PORT = process.env.PORT || 3000;
const app = express();

const routes = [
  { path: '/', title: 'Главная' },
  { path: '/about', title: 'О разработчике' },
  { path: '/contacts', title: 'Контакты' }
];

function layout(title, content) {
  const menu = routes.map((r) => `<a href="${r.path}">${r.title}</a>`).join(' | ');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f2f4f7; margin: 0; }
    nav { background: #2f3e4e; padding: 12px 30px; }
    nav a { color: #fff; text-decoration: none; margin-right: 6px; }
    .card { max-width: 640px; margin: 40px auto; background: #fff; padding: 25px 40px;
            border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); }
    h1 { color: #2f3e4e; }
    li { margin: 4px 0; }
  </style>
</head>
<body>
  <nav>${menu}</nav>
  <div class="card">${content}</div>
</body>
</html>`;
}

app.get('/', (req, res) => {
  const list = routes.map((r) => `<li><a href="${r.path}">GET ${r.path}</a> - ${r.title}</li>`).join('\n');

  res.send(layout('Лабораторная работа №16', `
    <h1>Лабораторная работа №16</h1>
    <p><b>Группа:</b> 401</p>
    <p><b>Дата и время:</b> ${new Date().toLocaleString('ru-RU')}</p>
    <p>Добро пожаловать! Сервер написан на Express.js.</p>
    <h3>Доступные маршруты</h3>
    <ul>${list}</ul>
  `));
});

app.get('/about', (req, res) => {
  res.send(layout('О разработчике', `
    <h1>О разработчике</h1>
    <p><b>Студент:</b> Клубович Михаил</p>
    <p><b>Группа:</b> 401</p>
    <p><b>Вариант:</b> 8</p>
    <p>Изучаю Node.js: файловая система, Koa.js, теперь Express.js.</p>
  `));
});

app.get('/contacts', (req, res) => {
  res.send(layout('Контакты', `
    <h1>Контакты</h1>
    <p><b>Email:</b> klybovich.mihail@gmail.com</p>
    <p><b>GitHub:</b> <a href="https://github.com/mikeklub2006">github.com/mikeklub2006</a></p>
    <p><b>Группа:</b> 401</p>
  `));
});

app.use((req, res) => {
  res.status(404).send(layout('Не найдено', `
    <h1>404</h1>
    <p>Такой страницы нет. <a href="/">На главную</a></p>
  `));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
