#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');

const GROUP = '401';
const STUDENT = 'Клубович Михаил';
const TYPES = ['html', 'pdf', 'json', 'csv'];

const program = new Command();

function fail(message) {
  console.error(`Ошибка: ${message}`);
  process.exit(1);
}

function verbose(text) {
  if (program.opts().verbose) console.log(`[VERBOSE] ${text}`);
}

function reportData() {
  return {
    group: GROUP,
    student: STUDENT,
    variant: 8,
    lab: 17,
    date: new Date().toISOString()
  };
}

function renderReport(type, data) {
  switch (type) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'csv':
      return Object.keys(data).join(',') + '\n' + Object.values(data).join(',') + '\n';
    case 'html': {
      const rows = Object.entries(data)
        .map(([key, value]) => `    <tr><td>${key}</td><td>${value}</td></tr>`)
        .join('\n');
      return `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"><title>Отчёт</title></head>\n<body>\n  <h1>Отчёт группы ${GROUP}</h1>\n  <table>\n${rows}\n  </table>\n</body>\n</html>\n`;
    }
    default:
      // настоящий pdf не собираем, просто текстовая заглушка
      return Object.entries(data).map(([key, value]) => `${key}: ${value}`).join('\n') + '\n';
  }
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i]; });
    return row;
  });
}

function toCsv(rows) {
  const list = Array.isArray(rows) ? rows : [rows];
  const headers = Object.keys(list[0] || {});
  return [headers.join(','), ...list.map((r) => headers.map((h) => r[h]).join(','))].join('\n') + '\n';
}

program
  .name('my-cli')
  .description('CLI-приложение для лабораторной работы №17')
  .version('1.0.0')
  .option('-v, --verbose', 'подробный вывод');

program
  .command('generate')
  .description('сгенерировать отчёт')
  .option('-t, --type <type>', 'тип отчёта (по умолчанию: "html")')
  .option('-o, --output <path>', 'путь для сохранения')
  .option('-f, --force', 'перезаписать существующий файл')
  .option('--dry-run', 'показать что будет сделано без выполнения')
  .action((options) => {
    const type = (options.type || 'html').toLowerCase();
    if (!TYPES.includes(type)) {
      fail(`недопустимый тип отчёта "${options.type}".\nДопустимые значения: ${TYPES.join(', ')}`);
    }
    const output = options.output || `./output.${type}`;

    if (options.dryRun) {
      console.log(`[DRY-RUN] Будет сгенерирован отчёт типа: ${type}`);
      console.log(`[DRY-RUN] Файл будет сохранён в: ${output}`);
      console.log('[DRY-RUN] Действия не выполнены (режим проверки)');
      return;
    }

    verbose('Запуск генерации отчёта...');
    verbose(`Тип отчёта: ${type}`);
    verbose(`Путь сохранения: ${output}`);

    if (fs.existsSync(output) && !options.force) {
      fail(`файл ${output} уже существует. Используйте --force для перезаписи`);
    }

    fs.writeFileSync(output, renderReport(type, reportData()), 'utf8');
    console.log(`Отчёт успешно сгенерирован: ${output}`);
  });

program
  .command('convert')
  .description('конвертировать файл')
  .requiredOption('-i, --input <file>', 'входной файл (.json или .csv)')
  .option('-o, --output <file>', 'выходной файл')
  .option('-f, --force', 'перезаписать существующий файл')
  .action((options) => {
    const input = options.input;
    const ext = path.extname(input).toLowerCase();
    if (ext !== '.json' && ext !== '.csv') {
      fail(`неподдерживаемый формат "${ext || input}". Поддерживаются .json и .csv`);
    }
    if (!fs.existsSync(input)) fail(`файл ${input} не найден`);

    const target = ext === '.json' ? '.csv' : '.json';
    const output = options.output || input.slice(0, -ext.length) + target;

    verbose(`Чтение ${input}`);
    const text = fs.readFileSync(input, 'utf8');
    let result;
    try {
      result = ext === '.json' ? toCsv(JSON.parse(text)) : JSON.stringify(parseCsv(text), null, 2);
    } catch (err) {
      fail(`не удалось разобрать ${input}: ${err.message}`);
    }

    if (fs.existsSync(output) && !options.force) {
      fail(`файл ${output} уже существует. Используйте --force для перезаписи`);
    }
    verbose(`Запись ${output}`);
    fs.writeFileSync(output, result, 'utf8');
    console.log(`Файл сконвертирован: ${input} -> ${output}`);
  });

program.parse();
