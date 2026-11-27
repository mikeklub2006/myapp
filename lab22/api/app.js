const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/logger');
const dbMiddleware = require('./middleware/db');
const cacheMiddleware = require('./middleware/cache');
const router = require('./routes');

function createApp(database) {
  const app = new Koa();

  app.use(requestLogger);
  app.use(errorHandler);
  app.use(dbMiddleware(database));
  app.use(bodyParser({
    enableTypes: ['json'],
    jsonLimit: config.bodyLimit,
    onerror(err, ctx) {
      if (err.status === 413) ctx.throw(413, `Тело запроса больше ${config.bodyLimit}`);
      ctx.throw(400, 'Некорректный JSON');
    }
  }));
  app.use(cacheMiddleware);
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}

module.exports = createApp;
