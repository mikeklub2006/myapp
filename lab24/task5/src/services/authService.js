const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../logger');
const User = require('../models/user');
const RefreshToken = require('../models/refreshToken');
const HttpError = require('../utils/httpError');
const userService = require('./userService');

async function issueTokens(user) {
  const payload = { userId: String(user._id), email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, config.jwtSecret, { algorithm: 'HS256', expiresIn: config.accessTtl });

  const jti = crypto.randomUUID();
  const refreshToken = jwt.sign({ userId: payload.userId, jti }, config.jwtRefreshSecret, {
    algorithm: 'HS256',
    expiresIn: config.refreshTtl
  });
  await RefreshToken.save(jti, payload.userId, new Date(jwt.decode(refreshToken).exp * 1000));

  const { iat, exp } = jwt.decode(accessToken);
  return { accessToken, refreshToken, expiresIn: exp - iat };
}

async function register(data, ip) {
  const user = await userService.createUser({ ...data, role: 'user' });
  logger.info({ email: user.email, ip }, 'Регистрация');
  const tokens = await issueTokens(user);
  return { data: { userId: user._id, email: user.email, role: user.role }, ...tokens };
}

async function login(email, password, ip) {
  const user = await User.findForLogin(email);
  const ok = user && user.password ? await bcrypt.compare(password, user.password) : false;

  // каждую попытку входа пишем в лог
  logger.info({ email, ip, success: ok }, 'Попытка входа');
  if (!ok) throw new HttpError(401, 'Invalid credentials');
  return issueTokens(user);
}

async function refresh(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwtRefreshSecret, { algorithms: ['HS256'] });
  } catch (err) {
    throw new HttpError(401, 'Invalid refresh token');
  }

  if (!(await RefreshToken.remove(payload.jti))) throw new HttpError(401, 'Invalid refresh token');

  const user = await User.findById(payload.userId);
  if (!user) throw new HttpError(401, 'Invalid refresh token');
  return issueTokens(user);
}

async function logout(token, user) {
  try {
    const payload = jwt.verify(token, config.jwtRefreshSecret, { algorithms: ['HS256'] });
    if (payload.userId === user.userId) await RefreshToken.remove(payload.jti);
  } catch (err) {
    // битый refresh-токен при выходе просто игнорируем
  }
  logger.info({ email: user.email }, 'Выход');
}

async function ensureAdmin() {
  if (await User.findByEmail(config.adminEmail)) return false;
  await userService.createUser(
    { name: 'Администратор', email: config.adminEmail, group_name: config.group, password: config.adminPassword, role: 'admin' },
    { sendMail: false }
  );
  logger.info({ email: config.adminEmail }, 'Создан администратор');
  return true;
}

module.exports = { issueTokens, register, login, refresh, logout, ensureAdmin };
