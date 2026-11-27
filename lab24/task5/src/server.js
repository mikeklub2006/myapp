const fs = require('fs');
const http = require('http');
const https = require('https');
const config = require('./config');
const logger = require('./logger');
const db = require('./db');
const migrate = require('./migrate');
const createApp = require('./app');
const attachWebSocket = require('./ws');
const authService = require('./services/authService');
const seed = require('../scripts/seed');

function createServer(app) {
  // в production при наличии сертификатов поднимаем https
  if (config.sslKey && config.sslCert) {
    return https.createServer({ key: fs.readFileSync(config.sslKey), cert: fs.readFileSync(config.sslCert) }, app.callback());
  }
  return http.createServer(app.callback());
}

async function start({ port = config.port, mongoUri } = {}) {
  const database = await db.connect(mongoUri);
  await migrate(database);
  await authService.ensureAdmin();
  if (config.seedOnStart) {
    const inserted = await seed(100);
    if (inserted) logger.info(`Добавлено тестовых пользователей: ${inserted} (seed 401)`);
  }

  const app = createApp();
  const server = createServer(app);
  const wss = attachWebSocket(server);

  await new Promise((resolve) => server.listen(port, resolve));
  const actualPort = server.address().port;
  const proto = config.sslKey && config.sslCert ? 'https' : 'http';

  logger.info(`Приложение запущено на порту ${actualPort}`);
  logger.info(`Swagger: ${proto}://localhost:${actualPort}/api-docs`);
  logger.info(`Metrics: ${proto}://localhost:${actualPort}/metrics`);
  logger.info(`Health: ${proto}://localhost:${actualPort}/health`);
  logger.info(`WebSocket: ws://localhost:${actualPort}/ws`);

  async function stop() {
    for (const client of wss.clients) client.terminate();
    wss.close();
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  }

  return { server, port: actualPort, stop };
}

if (require.main === module) {
  start()
    .then(({ stop }) => {
      const shutdown = async () => {
        logger.info('Остановка приложения');
        await stop();
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    })
    .catch((err) => {
      logger.fatal({ err }, 'Не удалось запустить приложение');
      process.exit(1);
    });
}

module.exports = { start };
