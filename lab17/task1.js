#!/usr/bin/env node

const GROUP = '401';
const STUDENT = 'Клубович Михаил';
const NAME = 'my-cli';

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function printHelp() {
  console.log(`Использование: ${NAME} <команда> [аргументы]`);
  console.log('Доступные команды:');
  console.log('  greet <имя>   - поприветствовать пользователя');
  console.log('  info          - вывести информацию о группе');
}

function greet(name) {
  if (!name) {
    console.error('Ошибка: не указано имя для команды greet');
    console.error(`Пример: ${NAME} greet "Иван"`);
    return 1;
  }
  console.log(`Привет, ${name}! Добро пожаловать в CLI-приложение группы ${GROUP}.`);
  return 0;
}

function info() {
  console.log(`Группа: ${GROUP}`);
  console.log(`Студент: ${STUDENT}`);
  console.log('Вариант: 8');
  console.log('Лабораторная работа: №17');
  console.log(`Дата: ${today()}`);
  return 0;
}

function main(argv) {
  const [command, ...args] = argv;

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return 0;
  }

  switch (command) {
    case 'greet':
      return greet(args.join(' ').trim());
    case 'info':
      return info();
    default:
      console.error(`Ошибка: неизвестная команда "${command}"`);
      console.error(`Для справки используйте: ${NAME} --help`);
      return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
