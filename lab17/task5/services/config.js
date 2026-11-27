const fs = require('fs');
const path = require('path');
const { CliError } = require('../utils/errors');

const DEFAULT_CONFIG = 'config.json';

function readConfig(dir, configPath) {
  const file = path.resolve(dir, configPath || DEFAULT_CONFIG);
  const name = path.basename(file);
  let text;

  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new CliError('файл конфигурации не найден', {
        hint: 'Укажите путь через --config',
        details: configPath ? `${file} не существует` : `${name} отсутствует в корне проекта`,
        short: `файл ${name} не найден`,
        cause: err
      });
    }
    throw err;
  }

  let config;
  try {
    config = JSON.parse(text);
  } catch (err) {
    throw new CliError(`не удалось разобрать ${name}`, {
      details: err.message,
      short: `${name} содержит ошибку`,
      cause: err
    });
  }

  if (!config.name) {
    throw new CliError(`в ${name} не указано поле "name"`, { short: `неверный ${name}` });
  }
  return { entry: 'src/index.js', outDir: 'dist', ...config };
}

module.exports = { readConfig, DEFAULT_CONFIG };
