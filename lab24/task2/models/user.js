const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const HttpError = require('../utils/httpError');
const log = require('../utils/log');

const COLLECTION = 'users';
const FIELDS = ['name', 'email', 'group_name', 'age', 'course', 'password'];
// пароль наружу никогда не отдаем
const PUBLIC = { projection: { password: 0 } };

function toObjectId(id) {
  if (!ObjectId.isValid(id) || String(new ObjectId(id)) !== String(id)) return null;
  return new ObjectId(id);
}

class User {
  static collection() {
    return getDb().collection(COLLECTION);
  }

  static async createIndexes() {
    await User.collection().createIndex({ email: 1 }, { unique: true });
  }

  // вторая линия защиты: проверка типов перед записью в базу
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
    const { filter = {}, sort = { created_at: 1 }, skip = 0, limit = 100 } = options;
    log('MODEL', 'find');
    return User.collection().find(filter, PUBLIC).sort(sort).skip(skip).limit(limit).toArray();
  }

  static async findById(id) {
    const _id = toObjectId(id);
    if (!_id) return null;
    log('MODEL', 'findOne by _id');
    return User.collection().findOne({ _id }, PUBLIC);
  }

  static async findByEmail(email) {
    log('MODEL', 'findOne by email');
    return User.collection().findOne({ email: String(email).toLowerCase() }, PUBLIC);
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
      { returnDocument: 'after', ...PUBLIC }
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
