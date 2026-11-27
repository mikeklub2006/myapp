class Cache {
  constructor(ttl) {
    this.ttl = ttl;
    this.items = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const item = this.items.get(key);
    if (!item || item.expires < Date.now()) {
      this.items.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return item.value;
  }

  set(key, value) {
    this.items.set(key, { value, expires: Date.now() + this.ttl });
  }

  clear() {
    this.items.clear();
  }

  stats() {
    return { size: this.items.size, hits: this.hits, misses: this.misses, ttlSeconds: this.ttl / 1000 };
  }
}

module.exports = Cache;
