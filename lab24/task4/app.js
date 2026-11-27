const config = require('./config');

const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const helmet = require('koa-helmet');
const cors = require('@koa/cors');
const db = require('./db');
const User = require('./models/user');
const RefreshToken = require('./models/refreshToken');
const usersRouter = require('./routes/users');
const { auth, admin } = require('./routes/auth');
const authService = require('./services/authService');
const { generateUsers } = require('./seed');
const dbMiddleware = require('./middleware/db');
const errorMiddleware = require('./middleware/error');
const loggerMiddleware = require('./middleware/logger');
const rateLimit = require('./middleware/rateLimit');
const sanitize = require('./middleware/sanitize');

async function main() {
  const database = await db.connect();
  await User.createIndexes();
  await RefreshToken.createIndexes();
  console.log('[INFO] MongoDB подключена');

  if (await User.count() === 0) {
    await User.insertMany(generateUsers(100));
    console.log('[INFO] Добавлено 100 тестовых пользователей (seed 401)');
  }
  await authService.ensureAdmin();

  const app = new Koa();

  app.use(async (ctx, next) => {
    ctx.set('X-Group', config.group);
    await next();
  });
  app.use(loggerMiddleware);
  app.use(errorMiddleware);
  app.use(helmet());
  app.use(cors({
    // разрешаем только источники из белого списка
    origin: (ctx) => (config.corsOrigins.includes(ctx.get('Origin')) ? ctx.get('Origin') : ''),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(rateLimit({ max: config.rateLimit, windowMs: 60 * 1000 }));
  app.use(bodyParser({
    enableTypes: ['json'],
    jsonLimit: '100kb',
    extendTypes: { json: ['application/x-www-form-urlencoded', 'text/plain'] },
    onerror: (err, ctx) => ctx.throw(400, 'Invalid JSON')
  }));
  app.use(sanitize);
  app.use(dbMiddleware(database));

  for (const router of [auth, admin, usersRouter]) {
    app.use(router.routes());
    app.use(router.allowedMethods({ throw: true }));
  }

  const server = app.listen(config.port, () => {
    console.log(`[INFO] Koa-сервер на порту ${config.port}`);
    console.log(`[INFO] Группа: ${config.group}`);
  });

  const shutdown = async () => {
    server.close();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[ERROR] Не удалось запустить сервер:', err.message);
  process.exit(1);
});
