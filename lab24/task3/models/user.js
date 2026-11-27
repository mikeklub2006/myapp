const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const HttpError = require('../utils/httpError');
const log = require('../utils/log');

const COLLECTION = 'users';
const FIELDS = ['name', 'email', 'group_name', 'age', 'course', 'password'];
const PUBLIC = { password: 0 };

function toObjectId(id) {
  if (!ObjectId.isValid(id) || String(new ObjectId(id)) !== String(id)) return null;
  return new ObjectId(id);
}

class User {
  static collection() {
    return getDb().collection(COLLECTION);
  }

  static async createIndexes() {
    const users = User.collection();
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ group_name: 1, course: 1 });
    await users.createIndex(
      { name: 'text', email: 'text' },
      { weights: { name: 3, email: 1 }, default_language: 'russian', name: 'name_email_text' }
    );
  }

  static validate(data) {
    const errors = [];
    if (data.name !== undefined && typeof data.name !== 'string') errors.push({ field: 'name', message: 'должно быть строкой' });
    if (data.email !== undefined && typeof data.email !== 'string') errors.push({ field: 'email', message: 'должно быть строкой' });
    if (data.group_name !== undefined && typeof data.group_name !== 'string') errors.push({ field: 'group_name', message: 'должно быть строкой' });
    if (data.age !== undefined && !Number.isInteger(data.age)) errors.push({ field: 'age', message: 'должно быть целым числом' });
    if (data.course !== undefined && !Number.isInteger(data.course)) errors.push({ field: 'course', message: 'должно быть целым числом' });
    if (errors.length) throw new HttpError(400, 'Validation failed', errors);
  }

  static pick(data) {
    const doc = {};
    for (const field of FIELDS) {
      if (data[field] !== undefined) doc[field] = data[field];
    }
    return doc;
  }

  static async findAll(options = {}) {
    const { filter = {}, sort = { created_at: 1 }, skip = 0, limit = 10 } = options;
    log('MODEL', `find ${JSON.stringify(filter)}`);

    let projection = PUBLIC;
    let order = sort;
    // при полнотекстовом поиске сортируем по релевантности
    if (filter.$text) {
      projection = { ...PUBLIC, score: { $meta: 'textScore' } };
      order = { score: { $meta: 'textScore' }, ...sort };
    }
    return User.collection().find(filter, { projection }).sort(order).skip(skip).limit(limit).toArray();
  }

  static async count(filter = {}) {
    return User.collection().countDocuments(filter);
  }

  static cursor(filter = {}, sort = { created_at: 1 }) {
    log('MODEL', 'find (cursor для экспорта)');
    return User.collection().find(filter, { projection: PUBLIC }).sort(sort);
  }

  static async search(query, limit = 20) {
    log('MODEL', `$text search "${query}"`);
    const filter = { $text: { $search: query } };
    const [found, data] = await Promise.all([
      User.collection().countDocuments(filter),
      User.collection()
        .find(filter, { projection: { name: 1, email: 1, group_name: 1, score: { $meta: 'textScore' } } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .toArray()
    ]);
    return { found, data };
  }

  static async stats() {
    log('MODEL', 'aggregate stats');
    const [result] = await User.collection().aggregate([
      {
        $facet: {
          total: [{ $group: { _id: null, count: { $sum: 1 }, averageAge: { $avg: '$age' } } }],
          byGroup: [{ $group: { _id: '$group_name', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          byCourse: [{ $match: { course: { $ne: null } } }, { $group: { _id: '$course', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]
        }
      }
    ]).toArray();
    return result;
  }

  static async findById(id) {
    const _id = toObjectId(id);
    if (!_id) return null;
    log('MODEL', 'findOne by _id');
    return User.collection().findOne({ _id }, { projection: PUBLIC });
  }

  static async findByEmail(email) {
    log('MODEL', 'findOne by email');
    return User.collection().findOne({ email: String(email).toLowerCase() }, { projection: PUBLIC });
  }

  static async create(data) {
    const doc = User.pick(data);
    User.validate(doc);
    doc.email = doc.email.toLowerCase();
    doc.created_at = new Date();

    log('MODEL', 'insertOne');
    const result = await User.collection().insertOne(doc);
    delete doc.password;
    return { _id: result.insertedId, ...doc };
  }

  static async insertMany(docs) {
    log('MODEL', `insertMany (${docs.length})`);
    return User.collection().insertMany(docs);
  }

  static async update(id, data) {
    const _id = toObjectId(id);
    if (!_id) return null;
    const changes = User.pick(data);
    User.validate(changes);
    if (changes.email) changes.email = changes.email.toLowerCase();

    log('MODEL', 'findOneAndUpdate');
    return User.collection().findOneAndUpdate(
      { _id },
      { $set: { ...changes, updated_at: new Date() } },
      { returnDocument: 'after', projection: PUBLIC }
    );
  }

  static async delete(id) {
    const _id = toObjectId(id);
    if (!_id) return false;
    log('MODEL', 'deleteOne');
    const result = await User.collection().deleteOne({ _id });
    return result.deletedCount === 1;
  }
}

module.exports = User;
