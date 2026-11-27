const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const env = process.env.NODE_ENV || 'development';

function secret(name, fallback) {
  const value = process.env[name];
  if (value) return value;
  // в production без секретов не стартуем
  if (env === 'production') throw new Error(`Переменная ${name} обязательна в production`);
  return fallback;
}

module.exports = {
  env,
  port: Number(process.env.PORT) || 3000,
  group: '401',
  mongoUri: process.env.MONGO_URI || '',
  dbName: process.env.DB_NAME || 'bbmo_401',
  jwtSecret: secret('JWT_SECRET', 'dev-access-secret-401'),
  jwtRefreshSecret: secret('JWT_REFRESH_SECRET', 'dev-refresh-secret-401'),
  accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTtl: process.env.REFRESH_TOKEN_TTL || '7d',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map((s) => s.trim()),
  rateLimit: Number(process.env.RATE_LIMIT_MAX) || 100,
  adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
  smtpUrl: process.env.SMTP_URL || '',
  mailFrom: process.env.MAIL_FROM || 'no-reply@bbmo401.local',
  sslKey: process.env.SSL_KEY_PATH || '',
  sslCert: process.env.SSL_CERT_PATH || '',
  seedOnStart: process.env.SEED_ON_START ? process.env.SEED_ON_START === 'true' : env === 'development',
  logLevel: process.env.LOG_LEVEL || (env === 'test' ? 'silent' : 'info')
};
