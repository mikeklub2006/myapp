const bcrypt = require('bcryptjs');
const User = require('../models/user');
const HttpError = require('../utils/httpError');
const { toCsv } = require('../utils/csv');
const { publish } = require('./notifier');
const mailService = require('./mailService');
const logger = require('../logger');

const SALT_ROUNDS = 10;
const EXPORT_COLUMNS = ['_id', 'name', 'email', 'group_name', 'age', 'course', 'role', 'created_at'];

function buildFilter(query = {}) {
  const filter = {};
  if (query.group_name) filter.group_name = query.group_name;
  if (query.course) filter.course = query.course;
  if (query.age_min !== undefined || query.age_max !== undefined) {
    filter.age = {};
    if (query.age_min !== undefined) filter.age.$gte = query.age_min;
    if (query.age_max !== undefined) filter.age.$lte = query.age_max;
  }
  if (query.search) filter.$text = { $search: query.search };
  return filter;
}

function buildSort(sort = 'created_at') {
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  return { [field]: desc ? -1 : 1, _id: 1 };
}

async function listUsers(query = {}) {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const filter = buildFilter(query);
  const withDeleted = Boolean(query.withDeleted);

  const [data, total] = await Promise.all([
    User.findAll({ filter, sort: buildSort(query.sort), skip: (page - 1) * limit, limit, withDeleted }),
    User.count(filter, withDeleted)
  ]);
  return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
}

async function searchUsers(q, limit) {
  const result = await User.search(q, limit);
  result.data = result.data.map((u) => ({ ...u, score: Number(u.score.toFixed(2)) }));
  return result;
}

async function getStats() {
  const result = await User.stats();
  const total = result.total[0] || { count: 0, averageAge: 0 };
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
  return {
    total: total.count,
    averageAge: Number((total.averageAge || 0).toFixed(1)),
    byGroup: toMap(result.byGroup),
    byCourse: toMap(result.byCourse),
    byRole: toMap(result.byRole)
  };
}

async function getUser(id) {
  const user = await User.findById(id);
  if (!user) throw new HttpError(404, 'User not found');
  return user;
}

async function ensureEmailFree(email, exceptId) {
  const existing = await User.findByEmail(email);
  if (existing && String(existing._id) !== String(exceptId)) {
    throw new HttpError(409, 'Email already exists');
  }
}

async function createUser(data, { sendMail = true } = {}) {
  await ensureEmailFree(data.email);
  const doc = { ...data };
  if (doc.password) doc.password = await bcrypt.hash(doc.password, SALT_ROUNDS);

  const user = await User.create(doc);
  logger.info({ email: user.email }, 'Пользователь создан');
  publish('user.created', { _id: user._id, name: user.name, email: user.email });
  if (sendMail) await mailService.sendWelcome(user);
  return user;
}

async function updateUser(id, data) {
  await getUser(id);
  if (data.email) await ensureEmailFree(data.email, id);

  const changes = { ...data };
  if (changes.password) changes.password = await bcrypt.hash(changes.password, SALT_ROUNDS);

  const user = await User.update(id, changes);
  publish('user.updated', { _id: user._id, changes: Object.keys(data).filter((k) => k !== 'password') });
  return user;
}

async function deleteUser(id) {
  const deleted = await User.softDelete(id);
  if (!deleted) throw new HttpError(404, 'User not found');
  publish('user.deleted', { _id: id });
}

async function restoreUser(id) {
  const user = await User.restore(id);
  if (!user) throw new HttpError(404, 'Deleted user not found');
  publish('user.restored', { _id: id });
  return user;
}

async function setAvatar(id, filename) {
  await getUser(id);
  return User.update(id, { avatar: filename });
}

async function exportUsers(query = {}) {
  const rows = [];
  for await (const user of User.cursor(buildFilter(query), buildSort(query.sort))) {
    rows.push(user);
  }
  return query.format === 'json' ? rows : toCsv(rows, EXPORT_COLUMNS);
}

// импорт: уже существующие email пропускаем, остальные вставляем пачкой
async function importUsers(items) {
  const emails = items.map((i) => i.email);
  const existing = await User.collection().find({ email: { $in: emails } }, { projection: { email: 1 } }).toArray();
  const taken = new Set(existing.map((u) => u.email));

  const seen = new Set();
  const fresh = items.filter((item) => {
    if (taken.has(item.email) || seen.has(item.email)) return false;
    seen.add(item.email);
    return true;
  });

  const inserted = fresh.length ? await User.insertMany(fresh) : 0;
  publish('users.imported', { inserted });
  return { inserted, skipped: items.length - inserted };
}

module.exports = {
  listUsers, searchUsers, getStats, getUser, createUser, updateUser,
  deleteUser, restoreUser, setAvatar, exportUsers, importUsers, buildFilter, buildSort
};
