const fs = require('fs');
const path = require('path');

/**
 * Собственная ошибка файловых операций
 */
class FileOperationError extends Error {
  constructor(message, operation, filename) {
    super(message);
    this.name = 'FileOperationError';
    this.operation = operation;
    this.filename = filename;
    this.timestamp = new Date();
  }
}

/**
 * Ошибка валидации аргументов
 */
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.timestamp = new Date();
  }
}

/**
 * Менеджер файлов, поддерживающий оба стиля вызова.
 * Если последним аргументом передан колбэк - работает как колбэк-функция,
 * если нет - возвращает промис.
 */
class FileManagerHybrid {
  constructor(baseDir = './data-hybrid') {
    this.baseDir = baseDir;

    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
      console.log(`Создана директория: ${baseDir}`);
    }
  }

  /**
   * Ключевой метод гибрида: решает, что вернуть
   * @param {Promise} task - промис с результатом операции
   * @param {Function} [callback] - необязательный колбэк
   */
  resolve(task, callback) {
    if (typeof callback !== 'function') {
      return task;
    }

    task
      .then(result => callback(null, result))
      .catch(err => callback(err, null));
  }

  /**
   * Проверка имени файла
   */
  validate(filename) {
    if (typeof filename !== 'string' || filename.trim() === '') {
      throw new ValidationError('Имя файла должно быть непустой строкой', 'filename');
    }
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new ValidationError('Имя файла не должно содержать путь', 'filename');
    }
  }

  createFile(filename, content, callback) {
    const task = (async () => {
      this.validate(filename);
      const filePath = path.join(this.baseDir, filename);

      try {
        await fs.promises.writeFile(filePath, content, 'utf8');
        return filePath;
      } catch (err) {
        throw new FileOperationError(err.message, 'createFile', filename);
      }
    })();

    return this.resolve(task, callback);
  }

  readFile(filename, callback) {
    const task = (async () => {
      this.validate(filename);
      const filePath = path.join(this.baseDir, filename);

      try {
        return await fs.promises.readFile(filePath, 'utf8');
      } catch (err) {
        if (err.code === 'ENOENT') {
          throw new FileOperationError(`Файл ${filename} не найден`, 'readFile', filename);
        }
        throw new FileOperationError(err.message, 'readFile', filename);
      }
    })();

    return this.resolve(task, callback);
  }

  getFileStats(filename, callback) {
    const task = (async () => {
      this.validate(filename);
      const filePath = path.join(this.baseDir, filename);

      try {
        const stats = await fs.promises.stat(filePath);
        return {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          isFile: stats.isFile()
        };
      } catch (err) {
        throw new FileOperationError(err.message, 'getFileStats', filename);
      }
    })();

    return this.resolve(task, callback);
  }

  deleteFile(filename, callback) {
    const task = (async () => {
      this.validate(filename);
      const filePath = path.join(this.baseDir, filename);

      try {
        await fs.promises.unlink(filePath);
        return filename;
      } catch (err) {
        throw new FileOperationError(err.message, 'deleteFile', filename);
      }
    })();

    return this.resolve(task, callback);
  }

  listFiles(callback) {
    const task = (async () => {
      try {
        const names = await fs.promises.readdir(this.baseDir);
        const checked = await Promise.all(
          names.map(async (name) => {
            const stats = await fs.promises.stat(path.join(this.baseDir, name));
            return { name, isFile: stats.isFile() };
          })
        );
        return checked.filter(f => f.isFile).map(f => f.name);
      } catch (err) {
        throw new FileOperationError(err.message, 'listFiles', this.baseDir);
      }
    })();

    return this.resolve(task, callback);
  }
}

module.exports = { FileManagerHybrid, FileOperationError, ValidationError };
