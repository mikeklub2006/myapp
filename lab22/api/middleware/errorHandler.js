const logger = require('../services/logger');

const MYSQL_ERRORS = {
  ER_DUP_ENTRY: [409, 'Запись с таким значением уже существует'],
  ER_NO_REFERENCED_ROW: [400, 'Связанная запись не найдена'],
  ER_NO_REFERENCED_ROW_2: [400, 'Связанная запись не найдена (проверьте group_name)'],
  ER_ROW_IS_REFERENCED_2: [409, 'На запись ссылаются другие данные'],
  ER_BAD_NULL_ERROR: [400, 'Обязательное поле не заполнено'],
  ECONNREFUSED: [503, 'База данных недоступна'],
  PROTOCOL_CONNECTION_LOST: [503, 'Соединение с базой данных потеряно'],
  ER_CON_COUNT_ERROR: [503, 'Слишком много соединений с базой данных'],
  ETIMEDOUT: [503, 'База данных не отвечает']
};

async function errorHandler(ctx, next) {
  try {
    await next();
    if (ctx.status === 404 && !ctx.body) {
      ctx.throw(404, `Маршрут ${ctx.method} ${ctx.path} не найден`);
    }
  } catch (err) {
    let status = err.status || (err.name === 'ValidationError' ? 400 : 500);
    let message = status < 500 ? err.message : 'Внутренняя ошибка сервера';
    if (MYSQL_ERRORS[err.code]) [status, message] = MYSQL_ERRORS[err.code];

    if (status >= 500) logger.error(`${ctx.method} ${ctx.url}: ${err.code || err.name}: ${err.message}`);

    ctx.status = status;
    ctx.body = {
      error: {
        status,
        code: err.code || err.name || 'ERROR',
        message,
        path: ctx.path
      }
    };
    if (err.transaction) ctx.body.transaction = err.transaction;
  }
}

module.exports = errorHandler;
