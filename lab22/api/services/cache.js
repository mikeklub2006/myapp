const config = require('../config');
const metrics = require('./metrics');

class Cache {
  constructor(ttl) {
    this.ttl = ttl;
    this.items = new Map();
    this.hits = 0;
    this.misses = 0;
    this.invalidations = 0;
  }

  get(key) {
    const item = this.items.get(key);
    if (item && item.expires > Date.now()) {
      this.hits++;
      metrics.recordCache(true);
      return item.value;
    }
    if (item) this.items.delete(key);
    this.misses++;
    metrics.recordCache(false);
    return undefined;
  }

  set(key, value) {
    this.items.set(key, { value, expires: Date.now() + this.ttl });
  }

  invalidate(prefix) {
    let removed = 0;
    for (const key of this.items.keys()) {
      if (key.startsWith(prefix)) {
        this.items.delete(key);
        removed++;
      }
    }
    if (removed) this.invalidations++;
    return removed;
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.items.size,
      keys: [...this.items.keys()],
      hits: this.hits,
      misses: this.misses,
      hitRate: total ? Math.round((this.hits / total) * 100) / 100 : 0,
      invalidations: this.invalidations,
      ttlSeconds: this.ttl / 1000
    };
  }
}

module.exports = new Cache(config.cacheTtl);
