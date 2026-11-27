const { ObjectId } = require('mongodb');
const { validate, mongoSchema, ValidationError } = require('../models/student');
const { log } = require('../middleware/logger');

const SORT_FIELDS = ['name', 'grade', 'course', 'group_name', 'created_at'];

class NotFoundError extends Error {
  constructor(message = 'Student not found') {
    super(message);
    this.status = 404;
  }
}

function toObjectId(id) {
  if (!ObjectId.isValid(id) || String(id).length !== 24) {
    throw new ValidationError([{ field: 'id', message: 'неверный ObjectId' }]);
  }
  return new ObjectId(id);
}

async function timed(name, fn) {
  const start = process.hrtime.bigint();
  try {
    return await fn();
  } finally {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    log(`${name} (${ms.toFixed(1)}ms)`);
  }
}

class StudentDAO {
  constructor(db, client) {
    this.db = db;
    this.client = client;
    this.collection = db.collection('students');
  }

  async init() {
    const exists = await this.db.listCollections({ name: 'students' }).hasNext();
    const validator = { $jsonSchema: mongoSchema() };
    if (exists) {
      await this.db.command({ collMod: 'students', validator, validationLevel: 'moderate' });
    } else {
      await this.db.createCollection('students', { validator });
    }

    const names = [];
    names.push(await this.collection.createIndex({ group_name: 1 }));
    names.push(await this.collection.createIndex({ email: 1 }, { unique: true }));
    names.push(await this.collection.createIndex({ name: 'text' }, { default_language: 'russian' }));
    return names;
  }

  async create(data) {
    validate(data);
    const doc = { ...data, created_at: new Date() };
    const result = await timed('insertOne students', () => this.collection.insertOne(doc));
    return { _id: result.insertedId, ...doc };
  }

  async findById(id) {
    const _id = toObjectId(id);
    const doc = await timed('findOne students', () => this.collection.findOne({ _id }));
    if (!doc) throw new NotFoundError();
    return doc;
  }

  async findAll(options = {}) {
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 10, 1), 100);
    const offset = Math.max(parseInt(options.offset, 10) || 0, 0);

    const filter = {};
    if (options.group_name) filter.group_name = String(options.group_name);
    if (options.course) filter.course = Number(options.course);
    if (options.grade_min || options.grade_max) {
      filter.grade = {};
      if (options.grade_min) filter.grade.$gte = Number(options.grade_min);
      if (options.grade_max) filter.grade.$lte = Number(options.grade_max);
    }

    let sort = { _id: 1 };
    if (options.sort) {
      const field = String(options.sort).replace(/^-/, '');
      if (!SORT_FIELDS.includes(field)) {
        throw new ValidationError([{ field: 'sort', message: `допустимые поля: ${SORT_FIELDS.join(', ')}` }]);
      }
      sort = { [field]: options.sort.startsWith('-') ? -1 : 1, _id: 1 };
    }

    const [data, total] = await timed('find students', () => Promise.all([
      this.collection.find(filter).sort(sort).skip(offset).limit(limit).toArray(),
      this.collection.countDocuments(filter)
    ]));
    return { data, pagination: { total, limit, offset } };
  }

  async update(id, data) {
    const _id = toObjectId(id);
    validate(data, true);
    const result = await timed('updateOne students', () => this.collection.findOneAndUpdate(
      { _id },
      { $set: { ...data, updated_at: new Date() } },
      { returnDocument: 'after' }
    ));
    if (!result) throw new NotFoundError();
    return result;
  }

  async delete(id) {
    const _id = toObjectId(id);
    const result = await timed('deleteOne students', () => this.collection.deleteOne({ _id }));
    if (result.deletedCount === 0) throw new NotFoundError();
    return { deleted: true, _id };
  }

  async search(query, limit = 20) {
    if (!query) throw new ValidationError([{ field: 'q', message: 'параметр обязателен' }]);
    const filter = { $text: { $search: String(query) } };
    const [data, found] = await timed('text search students', () => Promise.all([
      this.collection.find(filter, { projection: { name: 1, group_name: 1, grade: 1, score: { $meta: 'textScore' } } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .toArray(),
      this.collection.countDocuments(filter)
    ]));
    return { found, data };
  }

  async getStats() {
    const [result] = await timed('aggregate students', () => this.collection.aggregate([
      {
        $facet: {
          total: [{ $group: { _id: null, count: { $sum: 1 }, avg: { $avg: '$grade' } } }],
          byGroup: [{ $group: { _id: '$group_name', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          byCourse: [{ $group: { _id: '$course', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]
        }
      }
    ]).toArray());

    const total = result.total[0] || { count: 0, avg: 0 };
    return {
      total: total.count,
      averageGrade: Math.round(total.avg * 100) / 100,
      byGroup: Object.fromEntries(result.byGroup.map((g) => [g._id, g.count])),
      byCourse: Object.fromEntries(result.byCourse.map((c) => [c._id, c.count]))
    };
  }

  async batchCreate(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError([{ field: 'body', message: 'ожидается непустой массив' }]);
    }
    items.forEach((item, i) => {
      try {
        validate(item);
      } catch (err) {
        err.details = err.details.map((d) => ({ ...d, index: i }));
        throw err;
      }
    });

    const docs = items.map((item) => ({ ...item, created_at: new Date() }));
    const session = this.client.startSession();
    try {
      session.startTransaction();
      log('BEGIN TRANSACTION');
      const result = await timed('insertMany', () => this.collection.insertMany(docs, { session }));
      await session.commitTransaction();
      log('COMMIT');
      return { inserted: result.insertedCount, transaction: 'committed', ids: Object.values(result.insertedIds) };
    } catch (err) {
      await session.abortTransaction();
      log('ROLLBACK');
      err.transaction = 'aborted';
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async count() {
    return this.collection.estimatedDocumentCount();
  }

  async insertSeed(docs) {
    await this.collection.deleteMany({});
    return this.collection.insertMany(docs);
  }
}

module.exports = { StudentDAO, NotFoundError };
