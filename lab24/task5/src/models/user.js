const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

const COLLECTION = 'users';
const ROLES = ['user', 'moderator', 'admin'];
const FIELDS = ['name', 'email', 'group_name', 'age', 'course', 'password', 'role', 'avatar'];
const PUBLIC = { password: 0 };
const ALIVE = { deleted_at: null };

function toObjectId(id) {
  if (!ObjectId.isValid(id) || String(new ObjectId(id)) !== String(id)) return null;
  return new ObjectId(id);
}

function pick(data) {
  const doc = {};
  for (const field of FIELDS) {
    if (data[field] !== undefined) doc[field] = data[field];
  }
  if (doc.email) doc.email = String(doc.email).toLowerCase();
  return doc;
}

class User {
  static collection() {
    return getDb().collection(COLLECTION);
  }

  static async findAll({ filter = {}, sort = { created_at: 1 }, skip = 0, limit = 10, withDeleted = false } = {}) {
    const query = withDeleted ? filter : { ...filter, ...ALIVE };
    let projection = PUBLIC;
    let order = sort;
    if (filter.$text) {
      projection = { ...PUBLIC, score: { $meta: 'textScore' } };
      order = { score: { $meta: 'textScore' }, ...sort };
    }
    return User.collection().find(query, { projection }).sort(order).skip(skip).limit(limit).toArray();
  }

  static async count(filter = {}, withDeleted = false) {
    return User.collection().countDocuments(withDeleted ? filter : { ...filter, ...ALIVE });
  }

  static cursor(filter = {}, sort = { created_at: 1 }) {
    return User.collection().find({ ...filter, ...ALIVE }, { projection: PUBLIC }).sort(sort);
  }

  static async search(text, limit = 20) {
    const filter = { $text: { $search: text }, ...ALIVE };
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
    const [result] = await User.collection().aggregate([
      { $match: ALIVE },
      {
        $facet: {
          total: [{ $group: { _id: null, count: { $sum: 1 }, averageAge: { $avg: '$age' } } }],
          byGroup: [{ $group: { _id: '$group_name', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          byCourse: [{ $match: { course: { $ne: null } } }, { $group: { _id: '$course', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          byRole: [{ $group: { _id: '$role', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]
        }
      }
    ]).toArray();
    return result;
  }

  static async findById(id, { withDeleted = false } = {}) {
    const _id = toObjectId(id);
    if (!_id) return null;
    return User.collection().findOne(withDeleted ? { _id } : { _id, ...ALIVE }, { projection: PUBLIC });
  }

  static async findByEmail(email) {
    return User.collection().findOne({ email: String(email).toLowerCase() }, { projection: PUBLIC });
  }

  static async findForLogin(email) {
    return User.collection().findOne({ email: String(email).toLowerCase(), ...ALIVE });
  }

  static async create(data) {
    const doc = { role: 'user', ...pick(data), created_at: new Date(), deleted_at: null };
    const result = await User.collection().insertOne(doc);
    delete doc.password;
    return { _id: result.insertedId, ...doc };
  }

  static async insertMany(items) {
    const now = new Date();
    const docs = items.map((item) => ({ role: 'user', ...pick(item), created_at: item.created_at || now, deleted_at: null }));
    const result = await User.collection().insertMany(docs, { ordered: false });
    return result.insertedCount;
  }

  static async update(id, data) {
    const _id = toObjectId(id);
    if (!_id) return null;
    return User.collection().findOneAndUpdate(
      { _id, ...ALIVE },
      { $set: { ...pick(data), updated_at: new Date() } },
      { returnDocument: 'after', projection: PUBLIC }
    );
  }

  // soft delete: запись остается в базе с отметкой deleted_at
  static async softDelete(id) {
    const _id = toObjectId(id);
    if (!_id) return false;
    const result = await User.collection().updateOne({ _id, ...ALIVE }, { $set: { deleted_at: new Date() } });
    return result.modifiedCount === 1;
  }

  static async restore(id) {
    const _id = toObjectId(id);
    if (!_id) return null;
    return User.collection().findOneAndUpdate(
      { _id, deleted_at: { $ne: null } },
      { $set: { deleted_at: null, updated_at: new Date() } },
      { returnDocument: 'after', projection: PUBLIC }
    );
  }
}

User.ROLES = ROLES;
User.COLLECTION = COLLECTION;

module.exports = User;
