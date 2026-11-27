const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { CliError } = require('../utils/errors');

function parseTap(output) {
  const pick = (re) => {
    const m = output.match(re);
    return m ? Number(m[1]) : null;
  };
  return {
    total: pick(/^# tests (\d+)/m),
    passed: pick(/^# pass (\d+)/m),
    failed: pick(/^# fail (\d+)/m),
    coverage: pick(/^# all files\s*\|\s*([\d.]+)/m)
  };
}

function runTests(dir = process.cwd()) {
  const testsDir = path.join(dir, 'tests');
  if (!fs.existsSync(testsDir)) {
    throw new CliError('папка tests не найдена', {
      hint: 'Запустите команду в корне проекта, созданного через init',
      short: 'нет папки tests'
    });
  }

  const args = ['--test', '--experimental-test-coverage', '--test-reporter=tap'];
  // в бинарнике pkg подменяет вызов node на самого себя, поэтому запускаем node из PATH через shell
  const res = process.pkg
    ? spawnSync(`node ${args.join(' ')}`, { cwd: dir, encoding: 'utf8', shell: true })
    : spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8' });
  if (res.error) {
    throw new CliError('не удалось запустить node', { details: res.error.message, cause: res.error });
  }

  const stats = parseTap(res.stdout || '');
  if (stats.total === null) {
    throw new CliError('не удалось разобрать результат тестов', { details: (res.stderr || '').trim() });
  }
  return stats;
}

module.exports = { parseTap, runTests };
