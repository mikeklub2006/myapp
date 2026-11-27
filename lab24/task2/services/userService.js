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

async function listUsers() {
  return User.findAll();
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

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser, sendEmail };
