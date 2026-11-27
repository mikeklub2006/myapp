const db = require('../db');
const { register } = require('../metrics');

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Monitoring]
 *     summary: Проверка, что приложение живо
 *     responses:
 *       200: { description: '{ status, uptime, db }' }
 */
async function health(ctx) {
  const connected = await db.ping();
  ctx.body = { status: 'ok', uptime: Math.round(process.uptime()), db: connected ? 'connected' : 'disconnected' };
}

/**
 * @openapi
 * /ready:
 *   get:
 *     tags: [Monitoring]
 *     summary: Готовность принимать запросы (есть соединение с БД)
 *     responses:
 *       200: { description: Готово }
 *       503: { description: Не готово }
 */
async function ready(ctx) {
  const connected = await db.ping();
  ctx.status = connected ? 200 : 503;
  ctx.body = { ready: connected };
}

/**
 * @openapi
 * /metrics:
 *   get:
 *     tags: [Monitoring]
 *     summary: Метрики в формате Prometheus
 *     responses:
 *       200: { description: text/plain }
 */
async function metrics(ctx) {
  ctx.type = register.contentType;
  ctx.body = await register.metrics();
}

module.exports = { health, ready, metrics };
