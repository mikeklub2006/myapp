const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/user');
const RefreshToken = require('../models/refreshToken');
const HttpError = require('../utils/httpError');
const log = require('../utils/log');
const userService = require('./userService');

const LOG_FILE = path.join(__dirname, '..', 'logs', 'auth.log');

function logAttempt(email, ip, result) {
  const line = `${new Date().toISOString()} email=${email} ip=${ip} result=${result}`;
  log('AUTH', `Попытка входа: ${email}, ip=${ip}, результат: ${result}`);
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.appendFile(LOG_FILE, line + '\n', () => {});
}

async function issueTokens(user) {
  const payload = { userId: String(user._id), email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, config.jwtSecret, { algorithm: 'HS256', expiresIn: config.accessTtl });

  const jti = crypto.randomUUID();
  const refreshToken = jwt.sign({ userId: payload.userId, jti }, config.jwtRefreshSecret, {
    algorithm: 'HS256',
    expiresIn: config.refreshTtl
  });
  const { exp } = jwt.decode(refreshToken);
  await RefreshToken.save(jti, payload.userId, new Date(exp * 1000));

  const decoded = jwt.decode(accessToken);
  return { accessToken, refreshToken, expiresIn: decoded.exp - decoded.iat };
}

async function register(data) {
  const user = await userService.createUser({ ...data, role: 'user' });

  // для отчета: показываем, что в базе лежит только хэш
  const stored = await User.findRawById(user._id);
  log('AUTH', `Пароль сохранен в БД как хэш: ${stored.password}`);

  const tokens = await issueTokens(user);
  return { data: { userId: user._id, email: user.email, role: user.role }, ...tokens };
}

async function login(email, password, ip) {
  const user = await User.findForLogin(email);
  if (!user || !user.password) {
    logAttempt(email, ip, 'пользователь не найден');
    throw new HttpError(401, 'Invalid credentials');
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    logAttempt(email, ip, 'неверный пароль');
    throw new HttpError(401, 'Invalid credentials');
  }

  logAttempt(email, ip, 'успешно');
  return issueTokens(user);
}

async function refresh(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwtRefreshSecret, { algorithms: ['HS256'] });
  } catch (err) {
    throw new HttpError(401, 'Invalid refresh token');
  }

  // токен одноразовый: старый удаляем, выдаем новую пару
  const removed = await RefreshToken.remove(payload.jti);
  if (!removed) throw new HttpError(401, 'Invalid refresh token');

  const user = await User.findById(payload.userId);
  if (!user) throw new HttpError(401, 'Invalid refresh token');

  log('AUTH', `Обновление токена: ${user.email}`);
  return issueTokens(user);
}

async function logout(token, user) {
  try {
    const payload = jwt.verify(token, config.jwtRefreshSecret, { algorithms: ['HS256'] });
    if (payload.userId === user.userId) await RefreshToken.remove(payload.jti);
  } catch (err) {
    // даже с битым refresh-токеном просто считаем, что выход выполнен
  }
  log('AUTH', `Выход: ${user.email}`);
}

async function ensureAdmin() {
  const existing = await User.findByEmail(config.adminEmail);
  if (existing) return;
  const password = await bcrypt.hash(config.adminPassword, 10);
  await User.create({ name: 'Администратор', email: config.adminEmail, group_name: config.group, password, role: 'admin' });
  log('AUTH', `Создан администратор: ${config.adminEmail}`);
}

module.exports = { register, login, refresh, logout, ensureAdmin, issueTokens };
