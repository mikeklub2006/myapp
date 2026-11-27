const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

module.exports = {
  group: '401',
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'student',
    password: process.env.DB_PASSWORD || '',
    database: process.env.API_DB_NAME || 'group_401_api',
    charset: 'utf8mb4',
    connectionLimit: 10,
    decimalNumbers: true
  },
  cacheTtl: 60 * 1000,
  bodyLimit: '100kb',
  logFile: path.join(__dirname, '..', 'logs', 'sql.log')
};
