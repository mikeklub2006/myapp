const logger = require('../logger');
const { httpRequestsTotal, httpRequestDuration } = require('../metrics');

async function monitoring(ctx, next) {
  const start = process.hrtime.bigint();
  try {
    await next();
  } finally {
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    // в метках используем шаблон маршрута, а не реальный url, иначе меток будет слишком много
    const route = ctx._matchedRoute || (ctx.status === 404 ? 'unmatched' : ctx.path);

    httpRequestsTotal.inc({ method: ctx.method, path: route, status: String(ctx.status) });
    httpRequestDuration.observe({ method: ctx.method, path: route }, seconds);

    if (ctx.path !== '/metrics' && ctx.path !== '/health') {
      logger.info({
        method: ctx.method,
        url: ctx.originalUrl,
        status: ctx.status,
        ms: Number((seconds * 1000).toFixed(1)),
        user: ctx.user ? ctx.user.email : undefined
      }, 'request');
    }
  }
}

module.exports = monitoring;
