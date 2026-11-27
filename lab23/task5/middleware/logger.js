const { config } = require('../config/mongo');

function timestamp() {
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function log(message) {
  console.log(`[${timestamp()}] [${config.group}] ${message}`);
}

function info(message) {
  console.log(`[INFO] ${message}`);
}

function requestLogger() {
  return async (ctx, next) => {
    const start = process.hrtime.bigint();
    try {
      await next();
    } finally {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      log(`${ctx.method} ${ctx.url} -> ${ctx.status} (${ms.toFixed(1)}ms)`);
    }
  };
}

module.exports = { log, info, requestLogger };
