const metrics = {
  startedAt: Date.now(),
  requests: 0,
  errors: 0,
  totalTime: 0,
  byRoute: {}
};

function collectMetrics() {
  return async (ctx, next) => {
    const start = process.hrtime.bigint();
    try {
      await next();
    } finally {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const route = `${ctx.method} ${ctx._matchedRoute || ctx.path}`;
      if (!metrics.byRoute[route]) metrics.byRoute[route] = { count: 0, errors: 0, totalTime: 0 };
      const item = metrics.byRoute[route];

      metrics.requests++;
      metrics.totalTime += ms;
      item.count++;
      item.totalTime += ms;
      if (ctx.status >= 400) {
        metrics.errors++;
        item.errors++;
      }
    }
  };
}

function snapshot(cacheStats) {
  const byRoute = {};
  for (const [route, item] of Object.entries(metrics.byRoute)) {
    byRoute[route] = { count: item.count, errors: item.errors, averageTimeMs: +(item.totalTime / item.count).toFixed(2) };
  }
  return {
    uptimeSeconds: Math.round((Date.now() - metrics.startedAt) / 1000),
    requests: metrics.requests,
    errors: metrics.errors,
    averageTimeMs: metrics.requests ? +(metrics.totalTime / metrics.requests).toFixed(2) : 0,
    byRoute,
    cache: cacheStats
  };
}

module.exports = { collectMetrics, snapshot };
