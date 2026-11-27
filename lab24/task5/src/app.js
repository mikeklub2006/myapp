const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const helmet = require('koa-helmet');
const cors = require('@koa/cors');
const { koaSwagger } = require('koa2-swagger-ui');
const config = require('./config');
const router = require('./routes');
const spec = require('./swagger');
const errorMiddleware = require('./middleware/error');
const monitoring = require('./middleware/monitoring');
const rateLimit = require('./middleware/rateLimit');
const { sanitize } = require('./middleware/sanitize');

function createApp({ rateLimitMax = config.rateLimit } = {}) {
  const app = new Koa();
  app.proxy = config.env === 'production';

  app.use(async (ctx, next) => {
    ctx.set('X-Group', config.group);
    await next();
  });
  app.use(monitoring);
  app.use(errorMiddleware);

  // swagger ui подключаем до helmet: его csp не пускает встроенные скрипты страницы
  app.use(koaSwagger({ routePrefix: '/api-docs', swaggerOptions: { spec } }));
  app.use(async (ctx, next) => {
    if (ctx.path === '/api-docs/openapi.json') {
      ctx.body = spec;
      return;
    }
    await next();
  });

  app.use(helmet());
  app.use(cors({
    origin: (ctx) => (config.corsOrigins.includes(ctx.get('Origin')) ? ctx.get('Origin') : ''),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(rateLimit({ max: rateLimitMax }));
  app.use(bodyParser({
    enableTypes: ['json'],
    jsonLimit: '1mb',
    extendTypes: { json: ['application/x-www-form-urlencoded', 'text/plain'] },
    onerror: (err, ctx) => ctx.throw(400, 'Invalid JSON')
  }));
  app.use(sanitize);
  app.use(router.routes());
  app.use(router.allowedMethods({ throw: true }));

  return app;
}

module.exports = createApp;
