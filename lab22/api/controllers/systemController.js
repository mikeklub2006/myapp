const cache = require('../services/cache');
const metrics = require('../services/metrics');

async function cacheStats(ctx) {
  ctx.body = cache.stats();
}

async function dbMetrics(ctx) {
  ctx.body = metrics.snapshot();
}

module.exports = { cacheStats, dbMetrics };
