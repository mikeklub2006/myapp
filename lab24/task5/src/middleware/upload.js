const fs = require('fs');
const path = require('path');
const multer = require('@koa/multer');
const config = require('../config');
const HttpError = require('../utils/httpError');

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const storage = multer.diskStorage({
  destination(req, file, cb) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
    cb(null, config.uploadDir);
  },
  filename(req, file, cb) {
    // имя файла генерируем сами, чтобы нельзя было подсунуть путь
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});

const avatar = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!IMAGE_TYPES.includes(file.mimetype)) {
      cb(new HttpError(400, 'Only images are allowed (png, jpeg, gif, webp)'));
      return;
    }
    cb(null, true);
  }
});

const importFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = { avatar, importFile };
