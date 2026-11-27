const log = require('../utils/log');

async function loggerMiddleware(ctx, next) {
  const start = Date.now();
  await next();
  log('HTTP', `${ctx.method} ${ctx.originalUrl} ${ctx.status} (${Date.now() - start}ms)`);
}

module.exports = loggerMiddleware;
