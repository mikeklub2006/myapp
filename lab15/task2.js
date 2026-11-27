const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');

const PORT = process.env.PORT || 3000;
const app = new Koa();
const router = new Router({ prefix: '/api/users' });

let users = [
  { id: 1, name: 'Иванов Иван', group: '401' },
  { id: 2, name: 'Клубович Михаил', group: '401' },
  { id: 3, name: 'Смирнова Анна', group: '402' }
];
let nextId = 4;

function validate(body) {
  if (!body || typeof body !== 'object') return 'Тело запроса должно быть JSON-объектом';
  if (typeof body.name !== 'string' || !body.name.trim()) return 'Поле name обязательно';
  if (typeof body.group !== 'string' || !body.group.trim()) return 'Поле group обязательно';
  return null;
}

function findUser(ctx) {
  const id = Number(ctx.params.id);
  const user = users.find((u) => u.id === id);
  if (!user) ctx.throw(404, `Пользователь с id ${ctx.params.id} не найден`);
  return user;
}

router.get('/', (ctx) => {
  ctx.body = users;
});

router.get('/:id', (ctx) => {
  ctx.body = findUser(ctx);
});

router.post('/', (ctx) => {
  const error = validate(ctx.request.body);
  if (error) ctx.throw(400, error);

  const user = {
    id: nextId++,
    name: ctx.request.body.name.trim(),
    group: ctx.request.body.group.trim()
  };
  users.push(user);
  ctx.status = 201;
  ctx.body = user;
});

router.put('/:id', (ctx) => {
  const user = findUser(ctx);
  const error = validate(ctx.request.body);
  if (error) ctx.throw(400, error);

  user.name = ctx.request.body.name.trim();
  user.group = ctx.request.body.group.trim();
  ctx.body = user;
});

router.delete('/:id', (ctx) => {
  const user = findUser(ctx);
  users = users.filter((u) => u.id !== user.id);
  ctx.body = { message: `Пользователь с id ${user.id} удален` };
});

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = { error: err.message, status: ctx.status };
  }
});

app.use(bodyParser({
  enableTypes: ['json'],
  onerror: (err, ctx) => ctx.throw(400, 'Некорректный JSON в теле запроса')
}));
app.use(router.routes());
app.use(router.allowedMethods());

app.use((ctx) => {
  ctx.status = 404;
  ctx.body = { error: 'Маршрут не найден', status: 404 };
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log('API пользователей: /api/users');
});
