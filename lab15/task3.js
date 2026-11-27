const Koa = require('koa');
const Router = require('@koa/router');

const PORT = process.env.PORT || 3000;
const app = new Koa();
const router = new Router();

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const d = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const t = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${d} ${t}`;
}

async function logger(ctx, next) {
  const start = new Date();
  try {
    await next();
  } finally {
    const end = new Date();
    const ms = end - start;
    ctx.set('X-Response-Time', `${ms}ms`);
    console.log(`[${formatDate(start)}] ${ctx.method} ${ctx.path} - ${ms}ms`);
  }
}

async function errorHandler(ctx, next) {
  try {
    await next();
  } catch (err) {
    const status = err.status || 500;
    ctx.status = status;
    ctx.body = {
      error: status === 500 ? 'Внутренняя ошибка сервера' : err.message,
      status
    };
    if (status === 500) console.error('Ошибка:', err.message);
  }
}

async function auth(ctx, next) {
  const header = ctx.get('Authorization');
  if (!header) {
    ctx.throw(401, 'Требуется авторизация: отсутствует заголовок Authorization');
  }
  ctx.state.token = header;
  await next();
}

router.get('/', (ctx) => {
  ctx.body = {
    message: 'Лабораторная работа №15, задание 3',
    routes: ['GET /users', 'GET /protected (нужен Authorization)', 'GET /error']
  };
});

router.get('/users', (ctx) => {
  ctx.body = [
    { id: 1, name: 'Иванов Иван', group: '401' },
    { id: 2, name: 'Клубович Михаил', group: '401' }
  ];
});

router.get('/protected', auth, (ctx) => {
  ctx.body = {
    message: 'Доступ к защищенному маршруту разрешен',
    authorization: ctx.state.token
  };
});

router.get('/error', () => {
  throw new Error('Тестовое исключение из маршрута /error');
});

app.use(logger);
app.use(errorHandler);
app.use(router.routes());
app.use(router.allowedMethods());

app.use((ctx) => {
  ctx.throw(404, 'Маршрут не найден');
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
