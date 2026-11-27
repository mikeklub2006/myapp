const http = require('http');

const PORT = process.env.PORT || 3000;
const GROUP = '401';
const MAX_SIZE = 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const length = Number(req.headers['content-length'] || 0);
    if (length > MAX_SIZE) {
      reject({ status: 413 });
      return;
    }

    const chunks = [];
    let size = 0;
    let tooLarge = false;

    req.on('data', (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_SIZE) {
        tooLarge = true;
        reject({ status: 413 });
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (!tooLarge) resolve(Buffer.concat(chunks));
    });

    req.on('error', (err) => reject({ status: 400, message: err.message }));
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

function parseForm(text) {
  return Object.fromEntries(new URLSearchParams(text));
}

async function handleEcho(req, res) {
  const body = await readBody(req);
  const type = (req.headers['content-type'] || 'application/octet-stream').split(';')[0].trim();
  console.log(`POST /echo | ${type} | размер тела: ${body.length} байт`);

  if (type === 'application/json') {
    let data;
    try {
      data = JSON.parse(body.toString('utf8') || '{}');
    } catch (err) {
      sendJson(res, 400, { error: 'Некорректный JSON', details: err.message });
      return;
    }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      data.group = GROUP;
    }
    sendJson(res, 200, data);
  } else if (type === 'application/x-www-form-urlencoded') {
    sendJson(res, 200, parseForm(body.toString('utf8')));
  } else if (type === 'text/plain') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(body.toString('utf8'));
  } else {
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': body.length,
      'X-Body-Size': body.length
    });
    res.end(body);
  }
}

async function handleForm(req, res) {
  const body = await readBody(req);
  console.log(`POST /form | размер тела: ${body.length} байт`);
  sendJson(res, 200, parseForm(body.toString('utf8')));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/echo') {
      await handleEcho(req, res);
    } else if (req.method === 'POST' && req.url === '/form') {
      await handleForm(req, res);
    } else {
      sendJson(res, 404, { error: 'Not Found', hint: 'POST /echo или POST /form' });
    }
  } catch (err) {
    if (err.status === 413) {
      console.log(`${req.method} ${req.url} | тело больше ${MAX_SIZE} байт, 413`);
      res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8', Connection: 'close' });
      res.end('413 Payload Too Large\n');
      // дочитываем остаток, чтобы клиент получил ответ, а не обрыв соединения
      req.resume();
    } else {
      sendJson(res, err.status || 500, { error: err.message || 'Internal Server Error' });
    }
  }
});

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}, максимальный размер тела ${MAX_SIZE} байт`);
});
