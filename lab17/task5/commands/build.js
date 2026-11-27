const { build } = require('../services/build');
const out = require('../utils/output');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = async function buildCommand(options) {
  const started = Date.now();
  const spinner = out.spinner('Сборка проекта...');
  let res;
  try {
    await sleep(500);
    res = build({ configPath: options.config, dryRun: options.dryRun });
  } catch (err) {
    spinner.stop();
    throw err;
  }

  if (res.dryRun) {
    spinner.info(`[DRY-RUN] Будет создан файл ${res.output} (${res.size} байт), файлы не изменены`);
    return;
  }

  spinner.succeed(`Сборка завершена за ${out.formatDuration(Date.now() - started)}`);
  out.result(`Результат: ${res.output}`);
};
