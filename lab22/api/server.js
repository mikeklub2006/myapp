const config = require('./config');
const logger = require('./services/logger');
const { createDatabase } = require('./config/database');
const { migrate } = require('./migrations/migrate');
const createApp = require('./app');

async function start() {
  const database = createDatabase();
  const result = await migrate(() => {});
  logger.info(`Миграции применены: ${result.total} (новых: ${result.applied})`);

  const app = createApp(database);
  const server = app.listen(config.port, () => {
    logger.info(`Koa-сервер запущен на порту ${config.port}`);
    logger.info(`Группа: ${config.group}`);
  });

  const stop = () => {
    server.close();
    database.end().finally(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

start().catch((err) => {
  console.error(`[ERROR] Не удалось запустить сервер: ${err.code || ''} ${err.message}`);
  process.exit(1);
});
