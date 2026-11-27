const fs = require('fs').promises;
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');
const crypto = require('crypto');
const path = require('path');

const VARIANT = 8;
const SOURCE = path.join('.', `source_${VARIANT}`);
const BACKUP = path.join('.', `backup_${VARIANT}`);
const REPORT = path.join('.', `sync_report_${VARIANT}.txt`);

const STREAM_EXT = ['.txt', '.js', '.json'];
const BINARY_EXT = ['.jpg', '.png', '.gif'];
const CHUNK_SIZE = 512 * 1024;
const BIG_FILE = 1024 * 1024;
const HASH_LIMIT = 500 * 1024; // варианты 6-10: MD5 только для файлов больше 500 КБ

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} КБ`;
  return `${bytes} байт`;
}

function plural(n, forms) {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

function textBlock(size, seed) {
  const line = `Вариант ${VARIANT}. Файл ${seed}. Строка с тестовым содержимым.\n`;
  return line.repeat(Math.ceil(size / Buffer.byteLength(line))).slice(0, size);
}

function md5File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = createReadStream(file, { highWaterMark: 64 * 1024 });
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function createSourceStructure() {
  await fs.rm(SOURCE, { recursive: true, force: true });
  await fs.mkdir(SOURCE, { recursive: true });

  const rootFiles = [
    ['readme.txt', 2048], ['notes.txt', 4096], ['log.txt', 8192],
    ['app.js', 3072], ['utils.js', 1536], ['router.js', 2560],
    ['config.json', 1024], ['package.json', 2048], ['data.json', 6144],
    ['styles.css', 3584], ['index.html', 2048], ['report.md', 1024],
    ['table.csv', 5120], ['server.log', 7168], ['dump.bin', 4096],
    ['photo.jpg', 600 * 1024], ['icon.png', 12288], ['banner.gif', 20480],
    ['archive.txt', 1536 * 1024], ['backup.json', 1200 * 1024]
  ];

  for (const [name, size] of rootFiles) {
    await fs.writeFile(path.join(SOURCE, name), textBlock(size, name), 'utf8');
  }

  const subFolders = {
    docs: [['manual.md', 2048], ['spec.txt', 3072], ['changelog.md', 1024]],
    images: [['screen.png', 520 * 1024], ['logo.jpg', 8192]],
    scripts: [['build.js', 2048], ['deploy.js', 1536], ['env.json', 512]]
  };

  for (const [folder, files] of Object.entries(subFolders)) {
    const dir = path.join(SOURCE, folder);
    await fs.mkdir(dir, { recursive: true });
    for (const [name, size] of files) {
      await fs.writeFile(path.join(dir, name), textBlock(size, name), 'utf8');
    }
  }
}

async function collectFiles(dir, base = dir) {
  const result = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      result.push(...await collectFiles(fullPath, base));
      continue;
    }
    if (!entry.isFile()) continue;

    const info = await fs.stat(fullPath);
    result.push({
      relative: path.relative(base, fullPath),
      fullPath,
      size: info.size,
      ext: path.extname(entry.name).toLowerCase(),
      modified: info.mtime.toISOString()
    });
  }

  return result;
}

async function createManifest(files) {
  const manifest = {
    variant: VARIANT,
    createdAt: new Date().toISOString(),
    totalFiles: files.length,
    totalSize: files.reduce((sum, file) => sum + file.size, 0),
    files: []
  };

  for (const file of files) {
    const item = {
      path: file.relative,
      size: file.size,
      ext: file.ext,
      modified: file.modified
    };
    if (file.size > HASH_LIMIT) item.md5 = await md5File(file.fullPath);
    manifest.files.push(item);
  }

  await fs.writeFile(path.join(SOURCE, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}

function chooseMethod(file) {
  if (file.size > BIG_FILE) return 'chunks';
  if (STREAM_EXT.includes(file.ext)) return 'stream';
  if (BINARY_EXT.includes(file.ext)) return 'plain';
  return 'plain';
}

async function copyStream(src, dest) {
  await pipeline(createReadStream(src, { highWaterMark: 64 * 1024 }), createWriteStream(dest));
}

async function copyChunks(src, dest) {
  const source = await fs.open(src, 'r');
  const target = await fs.open(dest, 'w');

  try {
    const buffer = Buffer.alloc(CHUNK_SIZE);
    let position = 0;

    while (true) {
      const { bytesRead } = await source.read(buffer, 0, CHUNK_SIZE, position);
      if (bytesRead === 0) break;
      await target.write(buffer, 0, bytesRead, position);
      position += bytesRead;
    }
  } finally {
    await source.close();
    await target.close();
  }
}

function printFilePlan(files) {
  const names = { stream: 'потоковое копирование', chunks: 'копирование чанками', plain: 'обычное копирование' };
  const groups = new Map();

  for (const file of files) {
    const ext = file.ext || '<без расширения>';
    const method = chooseMethod(file);
    const key = `${ext}|${method}`;
    if (!groups.has(key)) groups.set(key, { ext, method, count: 0, size: 0 });
    const group = groups.get(key);
    group.count++;
    group.size += file.size;
  }

  const entries = [...groups.values()].sort((a, b) => b.count - a.count);

  console.log(`📋 Обнаружено файлов: ${files.length}`);
  entries.forEach((group, i) => {
    const prefix = i === entries.length - 1 ? '└──' : '├──';
    const word = plural(group.count, ['файл', 'файла', 'файлов']);
    console.log(`${prefix} 📄 ${group.ext}: ${group.count} ${word} (${formatSize(group.size)}) - ${names[group.method]}`);
  });
}

async function copyAll(files) {
  const stats = { stream: 0, chunks: 0, plain: 0, size: 0, failed: [] };
  let done = 0;

  for (const file of files) {
    const dest = path.join(BACKUP, file.relative);
    await fs.mkdir(path.dirname(dest), { recursive: true });

    const method = chooseMethod(file);
    try {
      if (method === 'stream') await copyStream(file.fullPath, dest);
      else if (method === 'chunks') await copyChunks(file.fullPath, dest);
      else await fs.copyFile(file.fullPath, dest);

      stats[method]++;
      stats.size += file.size;
    } catch (err) {
      stats.failed.push(`${file.relative}: ${err.message}`);
    }

    done++;
    if (done % 5 === 0 || done === files.length) {
      console.log(`⏳ Прогресс копирования: ${done}/${files.length} файлов`);
    }
  }

  return stats;
}

async function buildIndex(dir) {
  const files = await collectFiles(dir);
  const index = new Map();

  for (const file of files) {
    const item = { size: file.size, modified: file.modified };
    if (file.size > HASH_LIMIT) item.md5 = await md5File(file.fullPath);
    index.set(file.relative, item);
  }

  return index;
}

async function compare() {
  const source = await buildIndex(SOURCE);
  const backup = await buildIndex(BACKUP);

  const result = { same: [], modified: [], added: [], removed: [] };

  for (const [relative, info] of source) {
    const copy = backup.get(relative);
    if (!copy) {
      result.added.push(relative);
      continue;
    }

    const reasons = [];
    if (info.size !== copy.size) reasons.push('size');
    if (info.modified !== copy.modified) reasons.push('modified');
    if (info.md5 && copy.md5 && info.md5 !== copy.md5) reasons.push('md5');

    // время изменения при копировании не сохраняется, само по себе оно не признак правки
    if (reasons.includes('size') || reasons.includes('md5')) {
      result.modified.push(`${relative} (${reasons.join(', ')})`);
    } else {
      result.same.push(relative);
    }
  }

  for (const relative of backup.keys()) {
    if (!source.has(relative)) result.removed.push(relative);
  }

  return result;
}

// правим источник после копирования, чтобы сравнение нашло все три типа различий
async function makeChanges() {
  await fs.writeFile(path.join(SOURCE, 'new_file.txt'), textBlock(1024, 'new_file'), 'utf8');
  await fs.appendFile(path.join(SOURCE, 'notes.txt'), 'Строка, добавленная после копирования\n', 'utf8');
  await fs.appendFile(path.join(SOURCE, 'archive.txt'), 'Правка большого файла, проверяется по MD5\n', 'utf8');
  await fs.rm(path.join(SOURCE, 'dump.bin'), { force: true });
}

async function saveReport(result, stats, elapsed) {
  const lines = [
    `Отчет синхронизации, вариант ${VARIANT}`,
    `Дата: ${new Date().toLocaleString('ru-RU')}`,
    `Источник: ${SOURCE}`,
    `Назначение: ${BACKUP}`,
    '',
    'Копирование:',
    `- Потоковое копирование: ${stats.stream} файлов`,
    `- Копирование чанками по ${CHUNK_SIZE / 1024} КБ: ${stats.chunks} файлов`,
    `- Обычное копирование: ${stats.plain} файлов`,
    `- Общий размер: ${formatSize(stats.size)}`,
    `- Время выполнения: ${elapsed} сек`,
    '',
    'Сравнение каталогов:',
    `- Совпадают: ${result.same.length}`,
    `- Изменены: ${result.modified.length}`,
    `- Добавлены: ${result.added.length}`,
    `- Удалены: ${result.removed.length}`,
    ''
  ];

  if (result.modified.length) lines.push('Измененные файлы:', ...result.modified.map((f) => `  ${f}`), '');
  if (result.added.length) lines.push('Добавленные файлы:', ...result.added.map((f) => `  ${f}`), '');
  if (result.removed.length) lines.push('Удаленные файлы:', ...result.removed.map((f) => `  ${f}`), '');
  if (stats.failed.length) lines.push('Ошибки копирования:', ...stats.failed.map((f) => `  ${f}`), '');

  await fs.writeFile(REPORT, lines.join('\n'), 'utf8');
}

async function main() {
  try {
    await createSourceStructure();
    await createManifest(await collectFiles(SOURCE));
    console.log(`Создана структура ${SOURCE}, файл manifest.json готов`);

    await fs.rm(BACKUP, { recursive: true, force: true });
    await fs.mkdir(BACKUP, { recursive: true });

    console.log(`\n📂 Исходная директория: ${SOURCE}`);
    console.log(`📂 Директория назначения: ${BACKUP}`);

    const allFiles = await collectFiles(SOURCE);
    printFilePlan(allFiles);
    console.log('');

    const start = Date.now();
    const stats = await copyAll(allFiles);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    console.log('\n✅ Копирование завершено!');
    console.log('📊 Статистика:');
    console.log(`- Скопировано файлов: ${stats.stream + stats.chunks + stats.plain}`);
    console.log(`- Потоковое копирование: ${stats.stream} файлов`);
    console.log(`- Копирование чанками: ${stats.chunks} файлов`);
    console.log(`- Обычное копирование: ${stats.plain} файлов`);
    console.log(`- Общий размер: ${formatSize(stats.size)}`);
    console.log(`- Время выполнения: ${elapsed} сек`);
    if (stats.failed.length) console.log(`- Не скопировано: ${stats.failed.length} файлов`);

    await makeChanges();

    const result = await compare();
    const forms = ['файл', 'файла', 'файлов'];
    console.log('\n🔄 Сравнение директорий:');
    console.log(`- Совпадают: ${result.same.length} ${plural(result.same.length, forms)}`);
    console.log(`- Изменены: ${result.modified.length} ${plural(result.modified.length, forms)}`);
    console.log(`- Добавлены: ${result.added.length} ${plural(result.added.length, forms)}`);
    console.log(`- Удалены: ${result.removed.length} ${plural(result.removed.length, forms)}`);

    await saveReport(result, stats, elapsed);
    console.log(`\n📄 Отчет сохранен: ${REPORT}`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`Файл или каталог не найден: ${err.path}`);
    } else if (err.code === 'EACCES' || err.code === 'EPERM') {
      console.error('Недостаточно прав для копирования');
    } else if (err.code === 'ENOSPC') {
      console.error('Недостаточно места на диске');
    } else {
      console.error(`Ошибка при копировании: ${err.message}`);
    }
    process.exitCode = 1;
  }
}

main();
