const fs = require('fs').promises;
const { createReadStream, createWriteStream } = require('fs');
const readline = require('readline');
const path = require('path');

const VARIANT = 8;
const LINES = 100000;
const BUFFER_SIZE = 64 * 1024;
const SOURCE = path.join('.', `data_${VARIANT}.txt`);
const RESULT = path.join('.', `processed_${VARIANT}.txt`);

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} КБ`;
  return `${bytes} байт`;
}

function formatNumber(n) {
  return n.toLocaleString('ru-RU');
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function generateFile(file) {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(file, { encoding: 'utf8', highWaterMark: BUFFER_SIZE });
    stream.on('error', reject);
    stream.on('finish', resolve);

    let i = 1;

    // пишем с учетом backpressure, иначе память забьется буферами
    function write() {
      while (i <= LINES) {
        const line = `${i}, ${Math.floor(Math.random() * 1000) + 1}, Вариант ${VARIANT}\n`;
        i++;
        if (!stream.write(line)) {
          stream.once('drain', write);
          return;
        }
      }
      stream.end();
    }

    write();
  });
}

async function processFile(file, totalSize) {
  const stats = {
    lines: 0,
    sum: 0,
    min: Infinity,
    max: -Infinity,
    invalid: 0,
    frequency: new Map()
  };

  const stream = createReadStream(file, { encoding: 'utf8', highWaterMark: BUFFER_SIZE });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let processedBytes = 0;
  let nextStep = 10;

  for await (const line of rl) {
    processedBytes += Buffer.byteLength(line, 'utf8') + 1;

    const parts = line.split(',');
    const value = Number(parts[1]);

    if (parts.length < 3 || !Number.isFinite(value)) {
      stats.invalid++;
      continue;
    }

    stats.lines++;
    stats.sum += value;
    if (value > stats.max) stats.max = value;
    if (value < stats.min) stats.min = value;

    // варианты 6-10: считаем, как часто встречается каждое число
    stats.frequency.set(value, (stats.frequency.get(value) || 0) + 1);

    const percent = Math.floor((processedBytes / totalSize) * 100);
    if (percent >= nextStep) {
      console.log(`⏳ Прогресс: ${nextStep}% (${formatNumber(stats.lines)} строк обработано)`);
      nextStep += 10;
    }
  }

  if (nextStep <= 100) {
    console.log(`⏳ Прогресс: 100% (${formatNumber(stats.lines)} строк обработано)`);
  }

  return stats;
}

function topNumbers(frequency, count) {
  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, count);
}

function buildReport(stats, average, top, elapsed) {
  const lines = [
    `Отчет обработки файла ${path.basename(SOURCE)}`,
    `Вариант: ${VARIANT}`,
    `Дата: ${new Date().toLocaleString('ru-RU')}`,
    '',
    `Всего строк: ${formatNumber(stats.lines)}`,
    `Сумма чисел: ${formatNumber(stats.sum)}`,
    `Среднее значение: ${average.toFixed(2)}`,
    `Максимальное число: ${stats.max}`,
    `Минимальное число: ${stats.min}`,
    '',
    'Топ-10 самых часто встречающихся чисел:'
  ];

  top.forEach(([value, count], i) => {
    lines.push(`${i + 1}. Число ${value} - ${count} раз`);
  });

  lines.push('', `Время выполнения: ${elapsed} сек`);
  return lines.join('\n') + '\n';
}

async function main() {
  try {
    if (!(await fileExists(SOURCE))) {
      console.log(`Файл ${SOURCE} не найден, генерируем ${formatNumber(LINES)} строк...`);
      await generateFile(SOURCE);
      console.log('Файл сгенерирован');
    }

    const info = await fs.stat(SOURCE);
    if (info.size === 0) {
      console.error('Исходный файл пустой');
      process.exitCode = 1;
      return;
    }

    console.log(`\n📊 Обработка файла: ${path.basename(SOURCE)}`);
    console.log(`Размер файла: ${formatSize(info.size)}`);
    if (info.size > 1024 * 1024) {
      console.log(`Файл больше 1 МБ, читаем потоком с буфером ${BUFFER_SIZE / 1024} КБ\n`);
    }

    const start = Date.now();
    const stats = await processFile(SOURCE, info.size);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    if (stats.lines === 0) {
      console.error('Не найдено ни одной корректной строки');
      process.exitCode = 1;
      return;
    }

    const average = stats.sum / stats.lines;
    const top = topNumbers(stats.frequency, 10);

    console.log('\n✅ Обработка завершена!');
    console.log('📊 Результаты:');
    console.log(`- Всего строк: ${formatNumber(stats.lines)}`);
    console.log(`- Сумма чисел: ${formatNumber(stats.sum)}`);
    console.log(`- Среднее значение: ${average.toFixed(2)}`);
    console.log(`- Максимальное число: ${stats.max}`);
    console.log(`- Минимальное число: ${stats.min}`);
    if (stats.invalid) console.log(`- Пропущено некорректных строк: ${stats.invalid}`);

    console.log('\n🔢 Топ-10 часто встречающихся чисел:');
    top.forEach(([value, count], i) => {
      console.log(`  ${i + 1}. ${value} - ${count} раз`);
    });

    await fs.writeFile(RESULT, buildReport(stats, average, top, elapsed), 'utf8');
    console.log(`\n📄 Результаты сохранены в: ${RESULT}`);
    console.log(`⏱ Время выполнения: ${elapsed} сек`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`Файл не найден: ${err.path}`);
    } else if (err.code === 'EACCES') {
      console.error('Нет доступа к файлу');
    } else {
      console.error(`Ошибка при обработке файла: ${err.message}`);
    }
    process.exitCode = 1;
  }
}

main();
