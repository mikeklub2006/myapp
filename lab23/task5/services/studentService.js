const Cache = require('./cache');
const { config } = require('../config/mongo');
const { log } = require('../middleware/logger');
const { createRandom, makeStudent } = require('../../generator');

class StudentService {
  constructor(dao) {
    this.dao = dao;
    this.cache = new Cache(config.cacheTtl);
  }

  // кэшируем только чтение, ключ - адрес запроса
  async cached(key, fn) {
    const value = this.cache.get(key);
    if (value !== undefined) return { value, hit: true };
    const fresh = await fn();
    this.cache.set(key, fresh);
    return { value: fresh, hit: false };
  }

  invalidate(reason) {
    if (this.cache.items.size > 0) log(`cache invalidated (${reason})`);
    this.cache.clear();
  }

  list(key, query) {
    return this.cached(key, () => this.dao.findAll(query));
  }

  get(key, id) {
    return this.cached(key, () => this.dao.findById(id));
  }

  stats(key) {
    return this.cached(key, () => this.dao.getStats());
  }

  search(key, q) {
    return this.cached(key, () => this.dao.search(q));
  }

  async create(data) {
    const doc = await this.dao.create(data);
    this.invalidate('create');
    return doc;
  }

  async update(id, data) {
    const doc = await this.dao.update(id, data);
    this.invalidate('update');
    return doc;
  }

  async remove(id) {
    const result = await this.dao.delete(id);
    this.invalidate('delete');
    return result;
  }

  async batch(items) {
    const result = await this.dao.batchCreate(items);
    this.invalidate('batch');
    return result;
  }

  async seed(count = 1000) {
    const current = await this.dao.count();
    if (current >= 100) return 0;
    const random = createRandom(401);
    const docs = [];
    for (let i = 0; i < count; i++) {
      docs.push(makeStudent(random, i));
    }
    docs[0].name = 'Иван Иванов';
    await this.dao.insertSeed(docs);
    return count;
  }
}

module.exports = StudentService;
