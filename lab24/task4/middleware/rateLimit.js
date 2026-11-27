function rateLimit({ max = 100, windowMs = 60 * 1000 } = {}) {
  const hits = new Map();

  // раз в минуту чистим старые записи, чтобы map не рос бесконечно
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) {
      if (entry.reset <= now) hits.delete(ip);
    }
  }, windowMs);
  timer.unref();

  return async (ctx, next) => {
    const now = Date.now();
    let entry = hits.get(ctx.ip);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(ctx.ip, entry);
    }
    entry.count++;

    ctx.set('X-RateLimit-Limit', String(max));
    ctx.set('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));

    if (entry.count > max) {
      ctx.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      ctx.status = 429;
      ctx.body = { error: 'Too many requests', status: 429 };
      return;
    }
    await next();
  };
}

module.exports = rateLimit;
