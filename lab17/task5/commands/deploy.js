const { deploy } = require('../services/deploy');
const out = require('../utils/output');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = async function deployCommand(options) {
  const env = options.env;

  if (env === 'production' && !options.force) {
    out.warn('Вы собираетесь развернуть проект в production!');
    const ok = await out.confirm('Продолжить?');
    if (!ok) {
      out.warn('Развёртывание отменено');
      process.exitCode = 1;
      return;
    }
  }

  const spinner = out.spinner('Развёртывание...');
  let record;
  try {
    await sleep(700);
    record = deploy({ env, configPath: options.config });
  } catch (err) {
    spinner.stop();
    throw err;
  }
  spinner.succeed('Развёрнуто успешно');
  out.result(`URL: ${record.url}`);
};
