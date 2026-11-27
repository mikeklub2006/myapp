const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const db = require('./db');
const User = require('./models/user');
const usersRouter = require('./routes/users');
const dbMiddleware = require('./middleware/db');
const errorMiddleware = require('./middleware/error');
const loggerMiddleware = require('./middleware/logger');

const PORT = Number(process.env.PORT) || 3000;
const GROUP = '401';

async function main() {
  const database = await db.connect();
  await User.createIndexes();
  console.log('[INFO] MongoDB подключена');

  const app = new Koa();

  app.use(async (ctx, next) => {
    ctx.set('X-Group', GROUP);
    await next();
  });
  app.use(loggerMiddleware);
  app.use(errorMiddleware);
  app.use(bodyParser({
    enableTypes: ['json'],
    extendTypes: { json: ['application/x-www-form-urlencoded', 'text/plain'] },
    onerror: (err, ctx) => ctx.throw(400, 'Invalid JSON')
  }));
  app.use(dbMiddleware(database));
  app.use(usersRouter.routes());
  app.use(usersRouter.allowedMethods({ throw: true }));

  const server = app.listen(PORT, () => {
    console.log(`[INFO] Koa-сервер на порту ${PORT}`);
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
