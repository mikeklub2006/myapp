process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.MONGO_URI = '';
process.env.UPLOAD_DIR = require('path').join(__dirname, '..', '..', 'uploads', 'test');
