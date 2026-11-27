const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const db = require('./db');
const User = require('./models/user');
const usersRouter = require('./routes/users');

const PORT = Number(process.env.PORT) || 3000;
const GROUP = '401';

async function seed(database) {
  const users = database.collection(User.COLLECTION);
  if (await users.countDocuments() > 0) return;
  await users.insertMany([
    { name: 'Иван', email: 'ivan@example.com', group_name: GROUP, age: 20, created_at: new Date() },
    { name: 'Мария', email: 'maria@example.com', group_name: GROUP, age: 19, created_at: new Date() }
  ]);
}

async function main() {
  const database = await db.connect();
  await User.createIndexes(database);
  await seed(database);
  console.log('[INFO] MongoDB подключена');

  const app = new Koa();

  app.use(async (ctx, next) => {
    ctx.set('X-Group', GROUP);
    try {
      await next();
      if (ctx.status === 404 && !ctx.body) {
        ctx.status = 404;
        ctx.body = { error: 'Not found', status: 404 };
      }
    } catch (err) {
      let status = err.status || 500;
      let message = err.message;

      if (err.code === 11000) {
        status = 409;
        message = 'Email already exists';
      } else if (status === 500) {
        console.error('[ERROR]', err);
        message = 'Internal server error';
      }

      ctx.status = status;
      ctx.body = err.details ? { error: message, details: err.details } : { error: message, status };
    }
  });

  // curl без -H "Content-Type" шлет form-urlencoded, разбираем его тоже как json
  app.use(bodyParser({
    enableTypes: ['json'],
    extendTypes: { json: ['application/x-www-form-urlencoded', 'text/plain'] },
    onerror: (err, ctx) => ctx.throw(400, 'Invalid JSON')
  }));

  app.use(async (ctx, next) => {
    ctx.db = database;
    await next();
  });

  app.use(usersRouter.routes());
  app.use(usersRouter.allowedMethods({ throw: true }));

  const server = app.listen(PORT, () => {
    console.log(`[INFO] Koa-сервер на порту ${PORT}`);
    console.log(`[INFO] Группа: ${GROUP}`);
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
