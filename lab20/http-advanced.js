const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const selfsigned = require('selfsigned');

const PORT = Number(process.env.PORT) || 3000;
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 3443;
const GROUP = '401';
const PUBLIC_DIR = path.join(__dirname, 'public');
const CERT_DIR = path.join(__dirname, 'certs');
const BIG_FILE = path.join(__dirname, 'data', 'big-file.bin');
const BIG_FILE_SIZE = 100 * 1024 * 1024;
const CACHE_TTL = 60 * 1000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const startedAt = Date.now();
const metrics = { total: 0, byMethod: {}, byStatus: {}, cache: { hits: 0, misses: 0 } };
const cache = new Map();
const accessLog = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });

let notes = [
  { id: 1, text: 'Лабораторная работа 20', group: GROUP },
  { id: 2, text: 'HTTP без фреймворков', group: GROUP }
];

function timestamp() {
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
  return body;
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text + '\n');
}

function prepareFiles() {
  if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR);
  const keyPath = path.join(CERT_DIR, 'key.pem');
  const certPath = path.join(CERT_DIR, 'cert.pem');
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    const pems = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
      days: 365,
      keySize: 2048,
      algorithm: 'sha256'
    });
    fs.writeFileSync(keyPath, pems.private);
    fs.writeFileSync(certPath, pems.cert);
    console.log('[INFO] Сгенерирован самоподписанный сертификат certs/cert.pem');
  }

  if (!fs.existsSync(BIG_FILE)) {
    fs.mkdirSync(path.dirname(BIG_FILE), { recursive: true });
    const chunk = Buffer.alloc(1024 * 1024, `group ${GROUP} `);
    const fd = fs.openSync(BIG_FILE, 'w');
    for (let i = 0; i < BIG_FILE_SIZE / chunk.length; i++) fs.writeSync(fd, chunk);
    fs.closeSync(fd);
    console.log('[INFO] Создан файл для стриминга data/big-file.bin (100 МБ)');
  }

  return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}

function logger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const line = `[${timestamp()}] [${GROUP}] ${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`;
    console.log(line);
    accessLog.write(line + '\n');
  });
  next();
}

function countMetrics(req, res, next) {
  metrics.total++;
  metrics.byMethod[req.method] = (metrics.byMethod[req.method] || 0) + 1;
  res.on('finish', () => {
    metrics.byStatus[res.statusCode] = (metrics.byStatus[res.statusCode] || 0) + 1;
  });
  next();
}

function groupHeader(req, res, next) {
  res.setHeader('X-Group', GROUP);
  res.setHeader('X-Powered-By', 'Node.js');
  next();
}

function parseUrl(req, res, next) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  req.pathname = url.pathname;
  req.query = url.searchParams;
  next();
}

function readBody(req, res, next) {
  if (req.method !== 'POST' && req.method !== 'PUT') return next();
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    try {
      req.body = body ? JSON.parse(body) : {};
      next();
    } catch (err) {
      err.status = 400;
      err.message = 'Некорректный JSON';
      next(err);
    }
  });
}

function apiCache(req, res, next) {
  if (req.method !== 'GET' || !req.pathname.startsWith('/api/')) return next();

  const cached = cache.get(req.url);
  if (cached && cached.expires > Date.now()) {
    metrics.cache.hits++;
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'max-age=60',
      'X-Cache': 'HIT'
    });
    res.end(cached.body);
    return;
  }

  metrics.cache.misses++;
  res.setHeader('Cache-Control', 'max-age=60');
  res.setHeader('X-Cache', 'MISS');
  const originalEnd = res.end.bind(res);
  res.end = (body, ...rest) => {
    if (res.statusCode === 200 && body) {
      cache.set(req.url, { body, expires: Date.now() + CACHE_TTL });
    }
    return originalEnd(body, ...rest);
  };
  next();
}

function invalidateCache() {
  for (const key of cache.keys()) {
    if (key.startsWith('/api/notes')) cache.delete(key);
  }
}

function serveStatic(req, res, next) {
  // берём сырой url, new URL() уже убрал бы "../" из пути
  const rawUrl = req.url.split('?')[0];
  if (!rawUrl.startsWith('/static/')) return next();
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, '405 Method Not Allowed');

  const rawPath = rawUrl.slice('/static/'.length);
  let relative;
  try {
    relative = decodeURIComponent(rawPath);
  } catch (err) {
    return sendText(res, 400, '400 Bad Request');
  }

  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (relative.includes('\0') || !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return sendText(res, 403, '403 Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return sendText(res, 404, '404 Not Found');

    const etag = '"' + crypto.createHash('md5').update(`${stat.size}-${stat.mtimeMs}`).digest('hex').slice(0, 12) + '"';
    const lastModified = stat.mtime.toUTCString();

    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', lastModified);
    res.setHeader('Cache-Control', 'max-age=60');

    const noneMatch = req.headers['if-none-match'];
    const modifiedSince = req.headers['if-modified-since'];
    const notModified = noneMatch
      ? noneMatch === etag
      : modifiedSince && Math.floor(stat.mtimeMs / 1000) <= Math.floor(Date.parse(modifiedSince) / 1000);

    if (notModified) {
      res.writeHead(304);
      res.end();
      return;
    }

    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).on('error', next).pipe(res);
  });
}

function stream(req, res) {
  const size = fs.statSync(BIG_FILE).size;
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': size,
    'Content-Disposition': 'attachment; filename="big-file.bin"'
  });

  let sent = 0;
  let lastPercent = 0;
  const fileStream = fs.createReadStream(BIG_FILE, { highWaterMark: 1024 * 1024 });
  fileStream.on('data', (chunk) => {
    sent += chunk.length;
    const percent = Math.floor((sent / size) * 100);
    if (percent >= lastPercent + 25) {
      lastPercent = percent;
      console.log(`[STREAM] [${GROUP}] отправлено ${percent}% (${(sent / 1024 / 1024).toFixed(0)} МБ)`);
    }
  });
  fileStream.on('error', () => res.destroy());
  res.on('close', () => fileStream.destroy());
  fileStream.pipe(res);
}

function router(req, res, next) {
  const { pathname, method } = req;

  if (method === 'GET' && pathname === '/') {
    const secure = req.socket.encrypted ? 'HTTPS' : 'HTTP';
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`=== ${secure} работает! ===\nГруппа: ${GROUP}\n` +
      `Протокол: ${secure}, порт ${req.socket.localPort}, шифрование: ${req.socket.encrypted ? 'TLS' : 'нет'}\n`);
    return;
  }

  if (method === 'GET' && pathname === '/metrics') {
    sendJson(res, 200, {
      group: GROUP,
      total: metrics.total,
      byMethod: metrics.byMethod,
      byStatus: metrics.byStatus,
      cache: { ...metrics.cache, size: cache.size },
      uptime: Math.round((Date.now() - startedAt) / 1000)
    });
    return;
  }

  if (method === 'GET' && pathname === '/stream') return stream(req, res);

  if (method === 'GET' && pathname === '/api/notes') {
    sendJson(res, 200, { group: GROUP, generatedAt: new Date().toISOString(), notes });
    return;
  }

  if (method === 'POST' && pathname === '/api/notes') {
    if (!req.body.text) return sendJson(res, 400, { error: 'Поле text обязательно' });
    const note = { id: notes.length ? notes[notes.length - 1].id + 1 : 1, text: String(req.body.text), group: GROUP };
    notes.push(note);
    invalidateCache();
    sendJson(res, 201, note);
    return;
  }

  if (method === 'DELETE' && pathname.startsWith('/api/notes/')) {
    const id = Number(pathname.split('/').pop());
    const before = notes.length;
    notes = notes.filter((n) => n.id !== id);
    if (notes.length === before) return sendJson(res, 404, { error: `Заметка ${id} не найдена` });
    invalidateCache();
    sendJson(res, 200, { deleted: true, id });
    return;
  }

  if (method === 'GET' && pathname === '/error') {
    return next(new Error('Тестовая ошибка в обработчике'));
  }

  next();
}

function notFound(req, res) {
  sendText(res, 404, `404 Not Found: ${req.pathname}`);
}

const middleware = [logger, countMetrics, groupHeader, parseUrl, readBody, serveStatic, apiCache, router, notFound];

function handle(req, res) {
  let index = 0;

  function next(err) {
    if (err) return handleError(err, req, res);
    const fn = middleware[index++];
    if (!fn) return;
    try {
      fn(req, res, next);
    } catch (e) {
      handleError(e, req, res);
    }
  }

  next();
}

function handleError(err, req, res) {
  const status = err.status || 500;
  console.error(`[ERROR] [${GROUP}] ${req.method} ${req.url}: ${err.message}`);
  if (res.headersSent) return res.destroy();
  sendJson(res, status, { error: err.message, status, group: GROUP });
}

const tls = prepareFiles();
const httpServer = http.createServer(handle);
const httpsServer = https.createServer(tls, handle);

for (const server of [httpServer, httpsServer]) {
  server.on('error', (err) => {
    console.error(`[ERROR] Ошибка сервера: ${err.code || err.message}`);
    if (err.code === 'EADDRINUSE') process.exit(1);
  });

  server.on('clientError', (err, socket) => {
    console.error(`[WARN] [${GROUP}] Некорректный запрос: ${err.code || err.message}`);
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nX-Group: ' + GROUP + '\r\n\r\n');
    } else {
      socket.destroy();
    }
  });
}

httpServer.listen(PORT, () => console.log(`[INFO] HTTP-сервер запущен на порту ${PORT}`));
httpsServer.listen(HTTPS_PORT, () => {
  console.log(`[INFO] HTTPS-сервер запущен на порту ${HTTPS_PORT}`);
  console.log(`[INFO] Группа: ${GROUP}`);
});

let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`\n[INFO] Получен ${signal}, завершаем работу...`);
  let left = 2;
  const done = () => {
    if (--left > 0) return;
    accessLog.end(() => {
      console.log(`[INFO] Серверы остановлены, обработано запросов: ${metrics.total}`);
      process.exit(0);
    });
  };
  httpServer.close(done);
  httpsServer.close(done);
  httpServer.closeIdleConnections();
  httpsServer.closeIdleConnections();
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
