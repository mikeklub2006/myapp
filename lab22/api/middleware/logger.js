const logger = require('../services/logger');
const metrics = require('../services/metrics');

async function requestLogger(ctx, next) {
  const start = Date.now();
  metrics.recordRequest();
  try {
    await next();
  } finally {
    console.log(`[HTTP] ${ctx.method} ${ctx.url} ${ctx.status} (${Date.now() - start}ms)${ctx.state.cache ? ' cache=' + ctx.state.cache : ''}`);
  }
}

module.exports = requestLogger;
