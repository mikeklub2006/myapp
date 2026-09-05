const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>Привет, мир!</h1>');
});

server.listen(3000, () => {
  console.log('Сервер запущен на http://localhost:3000');
});