const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('./data');
const { schemas, validate } = require('./validation');

const JWT_SECRET = process.env.JWT_SECRET || 'lab16-variant8-secret';
const JWT_EXPIRES = '2h';

const router = express.Router();

router.post('/register', validate(schemas.register), async (req, res) => {
  const { email, password, name } = req.body;
  if (db.users.some((u) => u.email === email)) {
    return res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован', status: 409 });
  }

  const user = {
    id: db.nextUserId++,
    email,
    name,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'user'
  };
  db.users.push(user);
  res.status(201).json({
    message: 'Регистрация прошла успешно',
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  });
});

router.post('/login', validate(schemas.login), async (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find((u) => u.email === email);
  const ok = user && await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Неверный email или пароль', status: 401 });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, expiresIn: JWT_EXPIRES, user: { id: user.id, name: user.name, role: user.role } });
});

function authenticate(req, res, next) {
  const header = req.get('Authorization') || '';
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Нужен заголовок Authorization: Bearer <token>', status: 401 });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.users.find((u) => u.id === payload.id);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден', status: 401 });
    // роль берем из базы, а не из токена - вдруг ее поменяли после входа
    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Срок действия токена истек' : 'Недействительный токен';
    res.status(401).json({ error: message, status: 401 });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав для этого действия', status: 403 });
    }
    next();
  };
}

module.exports = { router, authenticate, requireRole };
