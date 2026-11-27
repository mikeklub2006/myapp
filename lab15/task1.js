const Koa = require('koa');

const PORT = process.env.PORT || 3000;
const app = new Koa();

function renderPage() {
  const now = new Date().toLocaleString('ru-RU');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Лабораторная работа №15</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f3f5f8; margin: 0; }
    .card { max-width: 600px; margin: 60px auto; background: #fff; padding: 30px 40px;
            border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); }
    h1 { color: #33475b; margin-top: 0; }
    .info { color: #555; line-height: 1.6; }
    .hello { margin-top: 20px; padding: 12px; background: #e8f4ea; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Лабораторная работа №15</h1>
    <div class="info">
      <p><b>Студент:</b> Клубович Михаил</p>
      <p><b>Группа:</b> 401</p>
      <p><b>Вариант:</b> 8</p>
      <p><b>Дата и время:</b> ${now}</p>
    </div>
    <div class="hello">Добро пожаловать! Этот сервер работает на Koa.js.</div>
  </div>
</body>
</html>`;
}

app.use(async (ctx) => {
  if (ctx.method === 'GET' && ctx.path === '/') {
    ctx.type = 'html';
    ctx.body = renderPage();
    return;
  }
  ctx.status = 404;
  ctx.body = 'Страница не найдена';
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
