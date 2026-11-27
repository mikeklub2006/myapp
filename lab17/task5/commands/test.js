const { runTests } = require('../services/tester');
const out = require('../utils/output');

module.exports = async function testCommand() {
  const spinner = out.spinner('Запуск тестов...');
  let stats;
  try {
    stats = runTests();
  } catch (err) {
    spinner.stop();
    throw err;
  }

  const line = `Пройдено: ${stats.passed}/${stats.total} тестов`;
  if (stats.failed > 0) {
    spinner.fail(line);
    process.exitCode = 1;
  } else {
    spinner.succeed(line);
  }

  if (stats.coverage !== null) out.success(`Покрытие: ${Math.round(stats.coverage)}%`);
  else out.warn('Покрытие не посчитано');
};
