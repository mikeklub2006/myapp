const fs = require('fs');
const path = require('path');
const { readConfig } = require('./config');
const { CliError } = require('../utils/errors');

const ENVS = ['development', 'staging', 'production'];

function getUrl(name, env) {
  if (env === 'production') return `https://${name}.example.com`;
  return `https://${name}.${env}.example.com`;
}

function deploy({ dir = process.cwd(), env = 'staging', configPath } = {}) {
  if (!ENVS.includes(env)) {
    throw new CliError(`неизвестное окружение "${env}"`, { hint: `Допустимые: ${ENVS.join(', ')}` });
  }
  const config = readConfig(dir, configPath);
  const artifact = path.resolve(dir, config.outDir, `${config.name}.js`);
  if (!fs.existsSync(artifact)) {
    throw new CliError('проект не собран', {
      hint: 'Сначала выполните my-cli build',
      short: 'нет сборки'
    });
  }

  const url = getUrl(config.name, env);
  const record = { name: config.name, env, url, deployedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, 'deploy.json'), JSON.stringify(record, null, 2) + '\n', 'utf8');
  return record;
}

module.exports = { ENVS, getUrl, deploy };
