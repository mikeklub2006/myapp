#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');

const TYPES = {
  web: 'Web-приложение',
  cli: 'CLI-утилита',
  lib: 'Библиотека',
  service: 'Микросервис'
};

const OPTIONS = {
  typescript: 'TypeScript',
  eslint: 'ESLint',
  prettier: 'Prettier',
  jest: 'Jest'
};

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', () => resolve(''));
  });
}

function printResult(project) {
  const extras = project.options.map((key) => OPTIONS[key]);
  console.log(`✓ Проект "${project.name}" успешно инициализирован!`);
  console.log(`  Тип: ${TYPES[project.type]}`);
  console.log(`  Опции: ${extras.length ? extras.join(', ') : 'нет'}`);
  console.log(`  Git: ${project.git ? 'да' : 'нет'}`);
}

function fromFlags(flags) {
  return {
    name: flags.name,
    type: flags.type,
    options: Object.keys(OPTIONS).filter((key) => flags[key]),
    git: Boolean(flags.git)
  };
}

async function askMissing(project) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Введите название проекта:',
      default: 'my-project',
      when: !project.name,
      validate: (value) => /^[a-z0-9._-]+$/i.test(value) || 'Допустимы латинские буквы, цифры, точка, дефис и _'
    },
    {
      type: 'list',
      name: 'type',
      message: 'Выберите тип проекта:',
      when: !project.type,
      choices: Object.entries(TYPES).map(([value, name]) => ({ name, value }))
    },
    {
      type: 'checkbox',
      name: 'options',
      message: 'Выберите дополнительные опции:',
      when: project.options.length === 0,
      choices: Object.entries(OPTIONS).map(([value, name]) => ({ name, value }))
    },
    {
      type: 'confirm',
      name: 'git',
      message: 'Использовать Git?',
      default: true,
      when: !project.git
    },
    {
      type: 'password',
      name: 'token',
      message: 'Введите токен доступа:',
      mask: '*'
    }
  ]);

  return {
    name: answers.name || project.name,
    type: answers.type || project.type,
    options: answers.options || project.options,
    git: answers.git !== undefined ? answers.git : project.git
  };
}

async function init(flags) {
  let project = fromFlags(flags);

  if (project.type && !TYPES[project.type]) {
    console.error(`Ошибка: неизвестный тип "${project.type}". Допустимо: ${Object.keys(TYPES).join(', ')}`);
    process.exit(1);
  }

  // данные пришли по конвейеру - диалог не нужен
  const piped = !process.stdin.isTTY;
  const interactive = flags.interactive && !piped;

  if (project.name && project.type) {
    printResult(project);
    return;
  }

  if (interactive) {
    console.log();
    project = await askMissing(project);
    console.log();
    printResult(project);
    return;
  }

  if (piped && !project.name) {
    const input = await readStdin();
    if (input) project.name = input.split(/\r?\n/)[0].trim();
  }

  if (!project.name && !project.type) {
    console.error('Ошибка: в неинтерактивном режиме необходимо указать --name и --type');
    process.exit(1);
  }
  if (!project.type) {
    console.error('Ошибка: недостаточно данных. Укажите --type');
    process.exit(1);
  }
  if (!project.name) {
    console.error('Ошибка: недостаточно данных. Укажите --name');
    process.exit(1);
  }

  printResult(project);
}

const program = new Command();

program
  .name('my-cli')
  .description('Интерактивная инициализация проекта (ЛР17, задание 3)')
  .version('1.0.0');

program
  .command('init')
  .description('инициализировать новый проект')
  .option('-n, --name <name>', 'название проекта')
  .option('-t, --type <type>', `тип проекта: ${Object.keys(TYPES).join(', ')}`)
  .option('--typescript', 'добавить TypeScript')
  .option('--eslint', 'добавить ESLint')
  .option('--prettier', 'добавить Prettier')
  .option('--jest', 'добавить Jest')
  .option('--git', 'инициализировать Git')
  .option('--no-interactive', 'отключить вопросы (для CI/CD)')
  .action((flags) => init(flags).catch((err) => {
    if (err.name === 'ExitPromptError' || err.isTtyError) {
      console.error('Ошибка: терминал не поддерживает интерактивный режим');
    } else {
      console.error(`Ошибка: ${err.message}`);
    }
    process.exit(1);
  }));

program.parse();
