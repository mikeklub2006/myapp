const http = require('http');

const PORT = process.env.PORT || 3000;
const GROUP = '401';

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data, null, 2));
}

function setCommonHeaders(res) {
  res.setHeader('X-Powered-By', 'Node.js');
  res.setHeader('X-Group', GROUP);
  res.setHeader('Cache-Control', 'no-cache');
}

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url} | user-agent: ${req.headers['user-agent']}`);
  const isGet = req.method === 'GET' || req.method === 'HEAD';

  if (isGet && req.url === '/headers') {
    setCommonHeaders(res);
    sendJson(res, 200, {
      headers: req.headers,
      special: {
        'user-agent': req.headers['user-agent'] || null,
        accept: req.headers.accept || null,
        host: req.headers.host || null,
        'content-type': req.headers['content-type'] || null
      },
      method: req.method,
      url: req.url,
      httpVersion: req.httpVersion
    });
    return;
  }

  if (isGet && req.url === '/headers/set') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    setCommonHeaders(res);
    res.setHeader('X-Temp', 'temp');
    res.removeHeader('X-Temp');
    res.statusCode = 200;
    res.end(`<h1>Заголовки установлены</h1><p>X-Group: ${res.getHeader('X-Group')}</p>`);
    return;
  }

  if (isGet && req.url === '/headers/check') {
    setCommonHeaders(res);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Debug', 'temp');

    const beforeRemove = res.hasHeader('X-Debug');
    res.removeHeader('X-Debug');

    sendJson(res, 200, {
      hasContentType: res.hasHeader('Content-Type'),
      hasXGroup: res.hasHeader('X-Group'),
      hasUnknown: res.hasHeader('X-Unknown'),
      xGroupValue: res.getHeader('x-group'),
      xDebugBeforeRemove: beforeRemove,
      xDebugAfterRemove: res.hasHeader('X-Debug'),
      headerNames: res.getHeaderNames()
    });
    return;
  }

  setCommonHeaders(res);
  sendJson(res, 404, { error: 'Not Found', url: req.url });
});

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
