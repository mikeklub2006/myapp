const request = require('supertest');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { start } = require('../../src/server');
const db = require('../../src/db');

let mongo;
let app;
let api;

function waitFor(messages, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`нет события ${event}`)), 5000);
    const check = () => {
      const found = messages.find((m) => m.event === event);
      if (found) {
        clearTimeout(timer);
        resolve(found);
      } else {
        setTimeout(check, 20);
      }
    };
    check();
  });
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  app = await start({ port: 0, mongoUri: mongo.getUri() });
  api = request(`http://127.0.0.1:${app.port}`);
});

afterAll(async () => {
  await app.stop();
  await mongo.stop();
});

test('полный цикл: регистрация, вход, защищенный запрос, обновление токена, выход', async () => {
  const reg = await api.post('/api/auth/register').send({ name: 'Иван', email: 'ivan@example.com', password: 'secret123' });
  expect(reg.status).toBe(201);
  expect(reg.body.data.email).toBe('ivan@example.com');

  // в базе хранится только bcrypt-хэш
  const stored = await db.getDb().collection('users').findOne({ email: 'ivan@example.com' });
  expect(stored.password).toMatch(/^\$2[aby]\$10\$/);

  const login = await api.post('/api/auth/login').send({ email: 'ivan@example.com', password: 'secret123' });
  expect(login.status).toBe(200);
  expect(login.body.expiresIn).toBe(900);

  const me = await api.get('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`);
  expect(me.body.data.email).toBe('ivan@example.com');

  const refreshed = await api.post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken });
  expect(refreshed.status).toBe(200);
  // старый refresh-токен одноразовый
  expect((await api.post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken })).status).toBe(401);

  const logout = await api.post('/api/auth/logout')
    .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
    .send({ refreshToken: refreshed.body.refreshToken });
  expect(logout.body.data.loggedOut).toBe(true);
  expect((await api.post('/api/auth/refresh').send({ refreshToken: refreshed.body.refreshToken })).status).toBe(401);
});

test('ошибки авторизации: неверный пароль, мусорный и истекший токен', async () => {
  const wrong = await api.post('/api/auth/login').send({ email: 'ivan@example.com', password: 'wrong' });
  expect(wrong.status).toBe(401);
  expect(wrong.body).toEqual({ error: 'Invalid credentials', status: 401 });

  const garbage = await api.get('/api/auth/me').set('Authorization', 'Bearer abc');
  expect(garbage.body.error).toBe('Invalid token');

  const expired = jwt.sign({ userId: 'x', email: 'x', role: 'user' }, process.env.JWT_SECRET, { expiresIn: -10 });
  const res = await api.get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
  expect(res.status).toBe(401);
  expect(res.body.error).toBe('Token expired');
});

test('websocket получает уведомления о создании, изменении и удалении', async () => {
  const messages = [];
  const socket = new WebSocket(`ws://127.0.0.1:${app.port}/ws`);
  socket.on('message', (raw) => messages.push(JSON.parse(raw)));
  await waitFor(messages, 'connected');

  const admin = await api.post('/api/auth/login').send({ email: 'admin@example.com', password: 'admin123' });
  const auth = { Authorization: `Bearer ${admin.body.accessToken}` };

  const created = await api.post('/api/users').set(auth).send({ name: 'Анна', email: 'anna@example.com', group_name: '401' });
  const id = created.body.data._id;
  await api.put(`/api/users/${id}`).set(auth).send({ course: 3 });
  await api.delete(`/api/users/${id}`).set(auth);

  expect((await waitFor(messages, 'user.created')).data.name).toBe('Анна');
  expect((await waitFor(messages, 'user.updated')).data.changes).toEqual(['course']);
  expect((await waitFor(messages, 'user.deleted')).data._id).toBe(id);

  socket.close();
});

test('метрики считают запросы', async () => {
  const res = await api.get('/metrics');
  expect(res.text).toMatch(/http_requests_total\{method="POST",path="\/api\/auth\/login",status="200"\} \d+/);
  expect(res.text).toContain('websocket_clients');
});
