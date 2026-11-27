const logger = require('../logger');

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
    } else if (err.code === 121) {
      // документ не прошел валидатор коллекции
      status = 400;
      message = 'Document failed validation';
    } else if (err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      message = 'File too large';
    } else if (status >= 500) {
      logger.error({ err }, 'Внутренняя ошибка');
      message = 'Internal server error';
    }

    ctx.status = status;
    ctx.body = err.details ? { error: message, details: err.details } : { error: message, status };
  }
}

module.exports = errorMiddleware;
