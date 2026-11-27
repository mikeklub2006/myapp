const project = require('../services/project');
const out = require('../utils/output');

module.exports = async function init(options) {
  const { root } = project.createProject({ name: options.name, type: options.type });
  out.success(`Проект "${options.name}" создан`);

  if (options.install) {
    const spinner = out.spinner('Установка зависимостей...');
    const ok = project.installDependencies(root);
    if (ok) spinner.succeed('Установлены зависимости');
    else spinner.warn('Не удалось выполнить npm install, установите зависимости вручную');
  }

  if (options.git) {
    if (project.initGit(root)) out.success('Инициализирован Git-репозиторий');
    else out.warn('Git не найден, репозиторий не создан');
  }

  out.result('Проект готов к работе!');
  out.info(`cd ${options.name} && my-cli build`);
};
