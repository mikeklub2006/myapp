const log = require('../utils/log');

async function errorMiddleware(ctx, next) {
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
    } else if (status >= 500) {
      log('ERROR', err.stack || err.message);
      message = 'Internal server error';
    }

    ctx.status = status;
    ctx.body = err.details ? { error: message, details: err.details } : { error: message, status };
  }
}

module.exports = errorMiddleware;
