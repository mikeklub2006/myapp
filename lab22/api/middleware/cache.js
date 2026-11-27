const cache = require('../services/cache');

const CACHED = ['/api/students', '/api/groups'];

async function cacheMiddleware(ctx, next) {
  const cacheable = ctx.method === 'GET' && CACHED.some((p) => ctx.path.startsWith(p));

  if (cacheable) {
    const hit = cache.get(ctx.url);
    if (hit !== undefined) {
      ctx.state.cache = 'HIT';
      ctx.set('X-Cache', 'HIT');
      ctx.body = hit;
      return;
    }
    ctx.state.cache = 'MISS';
    ctx.set('X-Cache', 'MISS');
  }

  await next();

  if (cacheable && ctx.status === 200) {
    cache.set(ctx.url, ctx.body);
  }

  // любые изменения сбрасывают кэш студентов и групп
  if (ctx.method !== 'GET' && ctx.status < 400 && CACHED.some((p) => ctx.path.startsWith(p))) {
    CACHED.forEach((p) => cache.invalidate(p));
  }
}

module.exports = cacheMiddleware;
