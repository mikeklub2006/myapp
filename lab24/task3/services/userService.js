const bcrypt = require('bcryptjs');
const User = require('../models/user');
const HttpError = require('../utils/httpError');
const log = require('../utils/log');

const SALT_ROUNDS = 10;

// имитация отправки письма, настоящего smtp тут нет
async function sendEmail(to, subject) {
  await new Promise((resolve) => setTimeout(resolve, 20));
  log('SERVICE', `Email отправлен: ${to} (${subject})`);
}

async function ensureEmailFree(email, exceptId) {
  log('SERVICE', 'Проверка уникальности email');
  const existing = await User.findByEmail(email);
  if (existing && String(existing._id) !== String(exceptId)) {
    log('SERVICE', 'Email уже существует');
    throw new HttpError(409, 'Email already exists');
  }
}

function buildFilter(query) {
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
  // второе поле нужно, чтобы порядок при одинаковых значениях был стабильным
  return { [field]: desc ? -1 : 1, _id: 1 };
}

async function listUsers(query = {}) {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const filter = buildFilter(query);

  const [data, total] = await Promise.all([
    User.findAll({ filter, sort: buildSort(query.sort), skip: (page - 1) * limit, limit }),
    User.count(filter)
  ]);

  return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
}

async function searchUsers(q, limit) {
  log('SERVICE', `Поиск: ${q}`);
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
    byCourse: toMap(result.byCourse)
  };
}

const CSV_COLUMNS = ['_id', 'name', 'email', 'group_name', 'age', 'course', 'created_at'];

function csvValue(value) {
  if (value === undefined || value === null) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function exportCsv(query = {}) {
  const lines = [CSV_COLUMNS.join(',')];
  // читаем курсором, чтобы не держать всё в памяти сразу
  for await (const user of User.cursor(buildFilter(query), buildSort(query.sort))) {
    lines.push(CSV_COLUMNS.map((c) => csvValue(user[c])).join(','));
  }
  log('SERVICE', `Экспорт CSV: ${lines.length - 1} строк`);
  return lines.join('\n') + '\n';
}

async function getUser(id) {
  const user = await User.findById(id);
  if (!user) throw new HttpError(404, 'User not found');
  return user;
}

async function createUser(data) {
  await ensureEmailFree(data.email);
  log('SERVICE', `Создание пользователя: ${data.email}`);

  const doc = { ...data };
  if (doc.password) doc.password = await bcrypt.hash(doc.password, SALT_ROUNDS);

  const user = await User.create(doc);
  await sendEmail(user.email, 'Добро пожаловать');
  return user;
}

async function updateUser(id, data) {
  await getUser(id);
  if (data.email) await ensureEmailFree(data.email, id);

  const changes = { ...data };
  if (changes.password) changes.password = await bcrypt.hash(changes.password, SALT_ROUNDS);

  log('SERVICE', `Обновление пользователя: ${id}`);
  return User.update(id, changes);
}

async function deleteUser(id) {
  const deleted = await User.delete(id);
  if (!deleted) throw new HttpError(404, 'User not found');
  log('SERVICE', `Пользователь удален: ${id}`);
}

module.exports = { listUsers, searchUsers, getStats, exportCsv, getUser, createUser, updateUser, deleteUser, sendEmail };
