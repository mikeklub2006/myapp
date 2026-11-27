#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const cliProgress = require('cli-progress');

const GROUP = '401';

// если stdout перенаправлен в файл - без цветов и без лишних сообщений
const toTerminal = Boolean(process.stdout.isTTY);
if (!toTerminal) chalk.level = 0;

const log = {
  success: (text) => toTerminal && console.error(chalk.green(`✔ ${text}`)),
  info: (text) => toTerminal && console.error(chalk.blue(`ℹ ${text}`)),
  warn: (text) => console.error(chalk.yellow(`⚠ ${text}`)),
  error: (text) => console.error(chalk.red(`✖ ${text}`))
};

function spin(text) {
  return ora({ text, isSilent: !toTerminal }).start();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function plural(n, forms) {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

// в PowerShell и cmd маска *.txt не раскрывается сама
function expand(patterns) {
  const result = [];
  for (const item of patterns) {
    if (!item.includes('*')) {
      result.push(item);
      continue;
    }
    const dir = path.dirname(item);
    const mask = new RegExp('^' + path.basename(item).replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
    if (!fs.existsSync(dir)) continue;
    fs.readdirSync(dir)
      .filter((name) => mask.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .forEach((name) => result.push(path.join(dir, name)));
  }
  return result;
}

function analyze(file) {
  const text = fs.readFileSync(file, 'utf8');
  const words = text.split(/\s+/).filter(Boolean);
  return {
    file,
    size: Buffer.byteLength(text),
    lines: text ? text.split(/\r?\n/).length : 0,
    words: words.length,
    chars: text.length
  };
}

async function processFiles(options) {
  const files = expand(options.files);
  if (files.length === 0) {
    log.error('Не найдено ни одного файла по указанным путям');
    process.exit(1);
  }

  const spinner = spin('Поиск файлов...');
  await sleep(400);
  const existing = files.filter((file) => fs.existsSync(file));
  const missing = files.filter((file) => !fs.existsSync(file));

  if (missing.length === 0) {
    spinner.succeed(chalk.green(`Файлы найдены (${files.length} шт.)`));
  } else {
    spinner.stop();
  }

  const results = [];
  const useBar = existing.length >= 5 && toTerminal;

  if (useBar) {
    missing.forEach((file) => log.error(`Файл ${file} не найден`));
    const work = spin('Подготовка...');
    await sleep(300);
    work.info(chalk.blue(`Обработка файлов (${existing.length} шт.)...`));
    const bar = new cliProgress.SingleBar({
      format: '[{bar}] {percentage}% | {value}/{total} | ETA: {eta_formatted}',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
      stream: process.stderr
    }, cliProgress.Presets.shades_classic);
    bar.start(existing.length, 0);
    for (const file of existing) {
      await sleep(options.delay);
      results.push(analyze(file));
      bar.increment();
    }
    bar.stop();
  } else {
    for (const file of files) {
      if (!fs.existsSync(file)) {
        if (toTerminal) log.error(`Файл ${file} не найден`);
        continue;
      }
      const step = spin(`Обработка ${file}...`);
      await sleep(options.delay);
      results.push(analyze(file));
      if (missing.length) step.succeed(chalk.green(`Файл ${file} обработан`));
      else step.stop();
    }
  }

  const data = {
    group: GROUP,
    createdAt: new Date().toISOString(),
    processed: results.length,
    missing,
    files: results
  };
  const json = JSON.stringify(data, null, 2);

  if (missing.length && toTerminal) {
    log.warn(`Пропущено ${missing.length} ${plural(missing.length, ['файл', 'файла', 'файлов'])}`);
  } else if (missing.length) {
    log.warn(`Обработано ${results.length} ${plural(results.length, ['файл', 'файла', 'файлов'])} из ${files.length} (отсутствует: ${missing.join(', ')})`);
  } else {
    log.success('Обработка завершена');
  }

  if (toTerminal) {
    fs.writeFileSync(options.output, json, 'utf8');
    console.log(`Результат сохранён: ${options.output}`);
  } else {
    process.stdout.write(json + '\n');
  }

  if (missing.length) process.exitCode = 1;
}

function makeSamples(dir, count) {
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 1; i <= count; i++) {
    const lines = [];
    for (let j = 0; j < 10 + ((401 * i) % 37); j++) {
      lines.push(`группа ${GROUP} файл ${i} строка ${j + 1} значение ${(401 * i * (j + 3)) % 1000}`);
    }
    fs.writeFileSync(path.join(dir, `file${i}.txt`), lines.join('\n'), 'utf8');
  }
  log.success(`Создано ${count} тестовых файлов в ${dir}`);
}

const program = new Command();

program
  .name('my-cli')
  .description('Обработка файлов с цветным выводом, спиннерами и прогресс-баром')
  .version('1.0.0');

program
  .command('process')
  .description('обработать текстовые файлы и собрать статистику')
  .requiredOption('--files <files...>', 'список файлов (поддерживается маска *.txt)')
  .option('-o, --output <path>', 'куда сохранить результат', 'output.json')
  .option('-d, --delay <ms>', 'задержка на файл, мс', (v) => parseInt(v, 10), 300)
  .action((options) => processFiles(options).catch((err) => {
    log.error(err.message);
    process.exit(1);
  }));

program
  .command('samples')
  .description('создать тестовые файлы для демонстрации')
  .option('--dir <dir>', 'каталог', 'samples')
  .option('-n, --count <n>', 'количество файлов', (v) => parseInt(v, 10), 10)
  .action((options) => makeSamples(options.dir, options.count));

program.parse();
