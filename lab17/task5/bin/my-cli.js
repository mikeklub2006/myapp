#!/usr/bin/env node

const { Command } = require('commander');
const { handleFatal } = require('../utils/errors');
const pkg = require('../package.json');
const init = require('../commands/init');
const build = require('../commands/build');
const test = require('../commands/test');
const deploy = require('../commands/deploy');

process.on('uncaughtException', handleFatal);
process.on('unhandledRejection', handleFatal);

const program = new Command();

program
  .name('my-cli')
  .description('CLI-приложение для управления проектом (ЛР17, группа 401)')
  .version(pkg.version, '-V, --version', 'вывести версию');

program
  .command('init')
  .description('инициализация проекта')
  .requiredOption('-n, --name <name>', 'название проекта')
  .option('-t, --type <type>', 'тип проекта: cli, web, lib, service', 'cli')
  .option('--no-install', 'не запускать npm install')
  .option('--no-git', 'не создавать git-репозиторий')
  .action(init);

program
  .command('build')
  .description('сборка проекта')
  .option('-c, --config <path>', 'путь к файлу конфигурации')
  .option('--dry-run', 'показать результат без записи файлов')
  .action(build);

program
  .command('test')
  .description('запуск тестов проекта')
  .action(test);

program
  .command('deploy')
  .description('развёртывание (для production нужно подтверждение или --force)')
  .option('-e, --env <env>', 'окружение: development, staging, production', 'staging')
  .option('-c, --config <path>', 'путь к файлу конфигурации')
  .option('-f, --force', 'не спрашивать подтверждение')
  .action(deploy);

// ошибки из команд специально не ловим - их обрабатывает unhandledRejection
program.parseAsync(process.argv);
