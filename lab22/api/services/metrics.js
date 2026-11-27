const stats = {
  queries: 0,
  errors: 0,
  totalTime: 0,
  slowest: 0,
  requests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  startedAt: Date.now()
};

function recordQuery(ms, failed) {
  stats.queries++;
  stats.totalTime += ms;
  if (ms > stats.slowest) stats.slowest = ms;
  if (failed) stats.errors++;
}

function recordCache(hit) {
  if (hit) stats.cacheHits++;
  else stats.cacheMisses++;
}

function recordRequest() {
  stats.requests++;
}

function snapshot() {
  const lookups = stats.cacheHits + stats.cacheMisses;
  return {
    queries: stats.queries,
    avgTime: stats.queries ? Math.round((stats.totalTime / stats.queries) * 100) / 100 : 0,
    slowestQuery: Math.round(stats.slowest * 100) / 100,
    errors: stats.errors,
    requests: stats.requests,
    cacheHitRate: lookups ? Math.round((stats.cacheHits / lookups) * 100) / 100 : 0,
    uptime: Math.round((Date.now() - stats.startedAt) / 1000)
  };
}

module.exports = { recordQuery, recordCache, recordRequest, snapshot };
