const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const GROUP = '401';

function getConfig(overrides) {
  return Object.assign({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'student',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'group_401',
    charset: 'utf8mb4'
  }, overrides);
}

function describeError(err, config = getConfig()) {
  switch (err.code) {
    case 'ECONNREFUSED':
      return `Сервер MySQL недоступен: ${config.host}:${config.port}`;
    case 'ER_ACCESS_DENIED_ERROR':
      return 'Доступ запрещён: неверный логин или пароль';
    case 'ER_BAD_DB_ERROR':
      return 'База данных не найдена';
    case 'ETIMEDOUT':
      return 'Превышено время ожидания подключения';
    default:
      return err.message;
  }
}

module.exports = { GROUP, getConfig, describeError };
