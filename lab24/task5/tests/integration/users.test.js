const fs = require('fs');
const request = require('supertest');
const createApp = require('../../src/app');
const config = require('../../src/config');
const authService = require('../../src/services/authService');
const User = require('../../src/models/user');
const { generateUsers } = require('../../src/utils/generateUsers');
const { startDb, clearUsers, stopDb } = require('../helpers/memoryDb');

let api;
let adminToken;
let userToken;
let userId;

beforeAll(async () => {
  await startDb();
  api = request(createApp().callback());
});

afterAll(async () => {
  fs.rmSync(config.uploadDir, { recursive: true, force: true });
  await stopDb();
});

beforeEach(async () => {
  await clearUsers();
  await User.insertMany(generateUsers(30));
  await authService.ensureAdmin();

  adminToken = (await api.post('/api/auth/login').send({ email: 'admin@example.com', password: 'admin123' })).body.accessToken;
  const reg = await api.post('/api/auth/register').send({ name: 'Иван', email: 'ivan@example.com', password: 'secret123', age: 20 });
  userToken = reg.body.accessToken;
  userId = reg.body.data.userId;
});

describe('GET /api/users', () => {
  test('пагинация и заголовок X-Group', async () => {
    const res = await api.get('/api/users?page=2&limit=5');
    expect(res.status).toBe(200);
    expect(res.headers['x-group']).toBe('401');
    expect(res.body.data).toHaveLength(5);
    expect(res.body.pagination).toEqual({ total: 32, page: 2, limit: 5, pages: 7 });
    expect(res.body.data[0].password).toBeUndefined();
  });

  test('фильтры по группе, курсу и возрасту', async () => {
    const res = await api.get('/api/users?group_name=401&course=2&age_min=18&age_max=25&limit=100');
    expect(res.status).toBe(200);
    for (const u of res.body.data) {
      expect(u.group_name).toBe('401');
      expect(u.course).toBe(2);
      expect(u.age).toBeGreaterThanOrEqual(18);
      expect(u.age).toBeLessThanOrEqual(25);
    }
  });

  test('сортировка по убыванию возраста', async () => {
    const res = await api.get('/api/users?sort=-age&limit=100');
    const ages = res.body.data.filter((u) => u.age).map((u) => u.age);
    expect(ages).toEqual([...ages].sort((a, b) => b - a));
  });

  test('ошибки валидации query-параметров', async () => {
    const res = await api.get('/api/users?page=0&limit=500&sort=password');
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining([
      { field: 'page', message: 'должно быть больше 0' },
      { field: 'limit', message: 'должно быть не больше 100' }
    ]));
  });

  test('поиск через ?search и /search', async () => {
    const list = await api.get('/api/users').query({ search: 'Иван' });
    expect(list.body.data.length).toBeGreaterThan(0);

    const res = await api.get('/api/users/search').query({ q: 'Иван' });
    expect(res.status).toBe(200);
    expect(res.body.found).toBeGreaterThan(0);
    expect(res.body.data[0].score).toBeGreaterThan(0);
  });

  test('статистика', async () => {
    const res = await api.get('/api/users/stats');
    expect(res.body.total).toBe(32);
    expect(Object.values(res.body.byGroup).reduce((a, b) => a + b, 0)).toBe(32);
    expect(res.body.averageAge).toBeGreaterThan(16);
  });

  test('экспорт в csv и json', async () => {
    const csv = await api.get('/api/users/export?group_name=402');
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('_id,name,email,group_name');

    const json = await api.get('/api/users/export?format=json');
    expect(json.body).toHaveLength(32);
  });
});

describe('изменение пользователей', () => {
  test('POST без токена - 401, с токеном - 201', async () => {
    const body = { name: 'Петр', email: 'petr@example.com', group_name: '401', age: 20 };
    expect((await api.post('/api/users').send(body)).status).toBe(401);

    const res = await api.post('/api/users').set('Authorization', `Bearer ${userToken}`).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Петр');
  });

  test('дубликат email - 409, неверные данные - 400', async () => {
    const auth = { Authorization: `Bearer ${userToken}` };
    const dup = await api.post('/api/users').set(auth).send({ name: 'Иван', email: 'ivan@example.com', group_name: '401' });
    expect(dup.status).toBe(409);

    const bad = await api.post('/api/users').set(auth).send({ name: 'П', email: 'invalid', group_name: '401' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('Validation failed');
  });

  test('невалидный json - 400', async () => {
    const res = await api.post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });

  test('PUT: владелец может, чужой пользователь - 403', async () => {
    const own = await api.put(`/api/users/${userId}`).set('Authorization', `Bearer ${userToken}`).send({ age: 22 });
    expect(own.body.data.age).toBe(22);

    const other = (await api.get('/api/users?limit=1')).body.data[0]._id;
    const res = await api.put(`/api/users/${other}`).set('Authorization', `Bearer ${userToken}`).send({ age: 22 });
    expect(res.status).toBe(403);
  });

  test('DELETE - мягкое удаление и восстановление админом', async () => {
    const other = (await api.get('/api/users?limit=1')).body.data[0]._id;
    const auth = { Authorization: `Bearer ${adminToken}` };

    expect((await api.delete(`/api/users/${other}`).set(auth)).status).toBe(200);
    expect((await api.get(`/api/users/${other}`)).status).toBe(404);

    const raw = await User.collection().findOne({ _id: new (require('mongodb').ObjectId)(other) });
    expect(raw.deleted_at).toBeInstanceOf(Date);

    const withDeleted = await api.get('/api/admin/users?withDeleted=true&limit=100').set(auth);
    expect(withDeleted.body.pagination.total).toBe(32);

    const restored = await api.post(`/api/admin/users/${other}/restore`).set(auth);
    expect(restored.body.data.deleted_at).toBeNull();
  });

  test('несуществующий id - 404', async () => {
    expect((await api.get('/api/users/999')).status).toBe(404);
    expect((await api.get('/api/users/507f1f77bcf86cd799439011')).body).toEqual({ error: 'User not found', status: 404 });
  });

  test('админка доступна только admin', async () => {
    const res = await api.get('/api/admin/users').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden: admin role required');

    const role = await api.patch(`/api/admin/users/${userId}/role`).set('Authorization', `Bearer ${adminToken}`).send({ role: 'moderator' });
    expect(role.body.data.role).toBe('moderator');
  });

  test('импорт csv и json', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const csv = 'name,email,group_name,age\nОлег,oleg@example.com,402,20\nИван,ivan@example.com,401,19\n';
    const res = await api.post('/api/users/import').set(auth).attach('file', Buffer.from(csv), 'users.csv');
    expect(res.body).toEqual({ inserted: 1, skipped: 1 });

    const json = await api.post('/api/users/import').set(auth).send([{ name: 'Борис', email: 'boris@example.com', group_name: '403' }]);
    expect(json.body.inserted).toBe(1);

    const file = await api.post('/api/users/import').set(auth)
      .attach('file', Buffer.from(JSON.stringify([{ name: 'Вера', email: 'vera@example.com', group_name: '401' }])), 'users.json');
    expect(file.body.inserted).toBe(1);

    expect((await api.post('/api/users/import').set(auth).send({ a: 1 })).status).toBe(400);
  });

  test('загрузка аватара', async () => {
    const auth = { Authorization: `Bearer ${userToken}` };
    const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');

    const res = await api.post(`/api/users/${userId}/avatar`).set(auth).attach('avatar', png, { filename: 'me.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.data.avatar).toMatch(/\.png$/);

    const img = await api.get(`/api/users/${userId}/avatar`);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');

    const txt = await api.post(`/api/users/${userId}/avatar`).set(auth).attach('avatar', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(txt.status).toBe(400);

    const empty = await api.post(`/api/users/${userId}/avatar`).set(auth);
    expect(empty.status).toBe(400);

    const other = (await api.get('/api/users?limit=1')).body.data[0]._id;
    expect((await api.get(`/api/users/${other}/avatar`)).status).toBe(404);
  });
});

describe('безопасность и мониторинг', () => {
  test('nosql-инъекция в логине отклоняется', async () => {
    const res = await api.post('/api/auth/login').send({ email: { $ne: null }, password: 'x' });
    expect(res.status).toBe(400);
  });

  test('helmet и cors', async () => {
    const ok = await api.get('/health').set('Origin', 'http://localhost:3000');
    expect(ok.headers['x-content-type-options']).toBe('nosniff');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');

    const evil = await api.get('/health').set('Origin', 'http://evil.example');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('rate limiting: 429 после превышения лимита', async () => {
    const limited = request(createApp({ rateLimitMax: 3 }).callback());
    for (let i = 0; i < 3; i++) await limited.get('/health');
    const res = await limited.get('/health');
    expect(res.status).toBe(429);
  });

  test('health, ready, metrics, swagger', async () => {
    expect((await api.get('/health')).body).toMatchObject({ status: 'ok', db: 'connected' });
    expect((await api.get('/ready')).status).toBe(200);

    const metrics = await api.get('/metrics');
    expect(metrics.text).toContain('http_requests_total');

    const docs = await api.get('/api-docs');
    expect(docs.status).toBe(200);
    expect(docs.text).toContain('swagger');

    const spec = await api.get('/api-docs/openapi.json');
    expect(Object.keys(spec.body.paths)).toEqual(expect.arrayContaining(['/api/users', '/api/auth/login', '/health']));
  });

  test('неизвестный маршрут и метод', async () => {
    expect((await api.get('/nope')).status).toBe(404);
    expect((await api.patch('/api/users')).status).toBe(405);
  });
});
