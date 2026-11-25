const TTL = 5 * 60 * 1000;
const store = new Map();

function cache(req, res, next) {
  if (req.method !== 'GET') return next();

  // рекомендации зависят от пользователя, поэтому id в ключе
  const key = `${req.user ? req.user.id : 'guest'}:${req.originalUrl}`;
  const entry = store.get(key);

  if (entry && entry.expires > Date.now()) {
    res.set('X-Cache', 'HIT');
    if (entry.type) res.type(entry.type);
    return res.status(entry.status).send(entry.body);
  }

  res.set('X-Cache', 'MISS');
  const originalSend = res.send.bind(res);
  res.send = (body) => {
    if (res.statusCode === 200) {
      store.set(key, {
        body,
        status: res.statusCode,
        type: res.get('Content-Type'),
        expires: Date.now() + TTL
      });
    }
    return originalSend(body);
  };
  next();
}

function clearCache() {
  store.clear();
}

module.exports = { cache, clearCache, TTL };
