const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const mongo = require('./config/mongo');
const { StudentDAO } = require('./dao/StudentDAO');
const StudentService = require('./services/studentService');
const dbMiddleware = require('./middleware/db');
const errorHandler = require('./middleware/errors');
const { requestLogger, info } = require('./middleware/logger');
const { collectMetrics } = require('./middleware/metrics');
const router = require('./routes/students');
const startStream = require('./streams/studentStream');

async function main() {
  const { config } = mongo;
  const client = await mongo.connect();
  const db = mongo.getDb();
  info(`MongoDB подключена: ${config.dbName}`);

  const dao = new StudentDAO(db, client);
  const indexes = await dao.init();
  info(`Индексы созданы: ${indexes.join(', ')}`);
  info('Валидатор коллекции students ($jsonSchema) установлен');

  const service = new StudentService(dao);
  const seeded = await service.seed();
  if (seeded) info(`Коллекция students заполнена: ${seeded} документов`);

  // данные могут поменять и в обход api, поэтому кэш сбрасываем еще и по change stream
  const stream = startStream(dao.collection, config.wsPort, () => service.invalidate('change stream'));

  const app = new Koa();
  app.use(requestLogger());
  app.use(collectMetrics());
  app.use(errorHandler());
  app.use(bodyParser({
    onerror(err, ctx) {
      ctx.throw(400, 'Invalid JSON');
    }
  }));
  app.use(dbMiddleware(db, service));
  app.use(router.routes());
  app.use(router.allowedMethods());

  const server = app.listen(config.port, () => {
    info(`Koa-сервер на порту ${config.port}`);
    info(`WebSocket на порту ${config.wsPort}`);
  });

  const shutdown = async () => {
    info('Остановка сервера');
    server.close();
    await stream.close();
    await mongo.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[ERROR] Не удалось запустить сервер:', err.message);
  process.exit(1);
});
