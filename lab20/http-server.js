const http = require('http');

const PORT = process.env.PORT || 3000;
const GROUP = '401';
const STUDENT = 'Клубович Михаил';

function timestamp() {
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function page(title, lines) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body>
  <h1>=== ${title} ===</h1>
  ${lines.map((line) => `<p>${line}</p>`).join('\n  ')}
</body>
</html>`;
}

function send(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

const server = http.createServer((req, res) => {
  res.on('finish', () => {
    console.log(`[${timestamp()}] ${req.method} ${req.url} ${res.statusCode}`);
  });

  if (req.method === 'GET' && req.url === '/') {
    send(res, 200, page('Лабораторная работа №20', [
      `Группа: ${GROUP}`,
      `Метод: ${req.method}`,
      `URL: ${req.url}`
    ]));
  } else if (req.method === 'GET' && req.url === '/about') {
    send(res, 200, page('О студенте', [
      `Группа: ${GROUP}`,
      `Студент: ${STUDENT}`,
      'Вариант: 8'
    ]));
  } else {
    send(res, 404, page('404 Not Found', [`Путь ${escapeHtml(req.url)} не найден`]));
  }
});

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
