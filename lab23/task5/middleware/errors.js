const { log } = require('./logger');

function errorHandler() {
  return async (ctx, next) => {
    try {
      await next();
      if (ctx.status === 404 && !ctx.body) {
        ctx.status = 404;
        ctx.body = { error: 'Not found', status: 404 };
      }
    } catch (err) {
      let status = err.status || 500;
      const body = { error: err.message };

      if (err.code === 11000) {
        status = 409;
        body.error = 'Duplicate key';
        const match = /dup key: (\{.*\})/.exec(err.message);
        if (match) body.key = match[1];
      } else if (err.code === 121) {
        // документ не прошел валидатор коллекции в самой mongodb
        status = 400;
        body.error = 'Document failed MongoDB validation';
      } else if (status === 500) {
        body.error = 'Internal server error';
        log(`ERROR ${err.stack}`);
      }

      if (err.details) body.details = err.details;
      if (err.transaction) body.transaction = err.transaction;
      body.status = status;
      ctx.status = status;
      ctx.body = body;
    }
  };
}

module.exports = errorHandler;
