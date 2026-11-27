const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Количество HTTP-запросов',
  labelNames: ['method', 'path', 'status'],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Время обработки HTTP-запроса',
  labelNames: ['method', 'path'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 1, 3],
  registers: [register]
});

const wsClients = new client.Gauge({
  name: 'websocket_clients',
  help: 'Количество подключенных WebSocket-клиентов',
  registers: [register]
});

module.exports = { register, httpRequestsTotal, httpRequestDuration, wsClients };
