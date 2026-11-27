const fs = require('fs').promises;
const path = require('path');

const VARIANT = 8;
const REPORT = path.join('.', `report_${VARIANT}.json`);
// варианты 6-10: служебные папки в статистику не попадают
const SKIP_DIRS = ['node_modules', '.git'];

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} КБ`;
  return `${bytes} байт`;
}

function formatNumber(n) {
  return n.toLocaleString('ru-RU');
}

function plural(n, forms) {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

async function scan(dir, stats) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.includes(entry.name)) {
        stats.skipped.push(fullPath);
        continue;
      }
      stats.dirs++;
      await scan(fullPath, stats);
      continue;
    }

    if (!entry.isFile()) continue;

    try {
      const info = await fs.stat(fullPath);
      const ext = path.extname(entry.name).toLowerCase() || '<без расширения>';

      stats.files++;
      stats.size += info.size;
      stats.list.push({ name: entry.name, path: fullPath, size: info.size, ext });

      if (!stats.extensions[ext]) stats.extensions[ext] = { count: 0, size: 0 };
      stats.extensions[ext].count++;
      stats.extensions[ext].size += info.size;
    } catch (err) {
      // битые симлинки и файлы без доступа просто пропускаем
      stats.errors.push(`${fullPath}: ${err.code || err.message}`);
    }
  }
}

function buildReport(target, stats) {
  const sorted = [...stats.list].sort((a, b) => b.size - a.size);

  return {
    variant: VARIANT,
    directory: target,
    createdAt: new Date().toISOString(),
    totalDirs: stats.dirs,
    totalFiles: stats.files,
    totalSize: {
      bytes: stats.size,
      kb: +(stats.size / 1024).toFixed(2),
      mb: +(stats.size / 1024 / 1024).toFixed(2)
    },
    extensions: Object.entries(stats.extensions)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([ext, data]) => ({ ext, count: data.count, size: data.size })),
    largestFiles: sorted.slice(0, 5),
    smallestFiles: sorted.slice(-5).reverse(),
    ignoredDirs: stats.skipped,
    errors: stats.errors
  };
}

function printReport(report) {
  console.log(`\n📊 Анализ директории: ${report.directory}`);
  console.log(`📁 Общее количество папок: ${formatNumber(report.totalDirs)}`);
  console.log(`📄 Общее количество файлов: ${formatNumber(report.totalFiles)}`);
  console.log(`💾 Общий размер: ${formatSize(report.totalSize.bytes)} (${formatNumber(report.totalSize.bytes)} байт)`);

  console.log('\n📂 Расширения файлов:');
  for (const item of report.extensions) {
    const word = plural(item.count, ['файл', 'файла', 'файлов']);
    console.log(`  ${item.ext}: ${item.count} ${word} (${formatSize(item.size)})`);
  }

  console.log('\n🏆 Топ-5 самых больших файлов:');
  report.largestFiles.forEach((file, i) => {
    console.log(`  ${i + 1}. ${file.name} (${formatSize(file.size)}) - ${file.path}`);
  });

  console.log('\n📉 Топ-5 самых маленьких файлов:');
  report.smallestFiles.forEach((file, i) => {
    console.log(`  ${i + 1}. ${file.name} (${formatSize(file.size)}) - ${file.path}`);
  });

  if (report.ignoredDirs.length) {
    console.log(`\n🚫 Пропущено служебных папок: ${report.ignoredDirs.length} (${SKIP_DIRS.join(', ')})`);
  }
}

async function main() {
  const target = process.argv[2] || '.';

  try {
    const info = await fs.stat(target);
    if (!info.isDirectory()) {
      console.error(`${target} не является директорией`);
      process.exitCode = 1;
      return;
    }

    const stats = { files: 0, dirs: 0, size: 0, extensions: {}, list: [], skipped: [], errors: [] };
    await scan(target, stats);

    if (stats.files === 0) {
      console.log(`В директории ${target} не найдено файлов`);
      return;
    }

    const report = buildReport(target, stats);
    printReport(report);

    await fs.writeFile(REPORT, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n📄 Отчет сохранен: ${REPORT}`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`Директория не найдена: ${target}`);
    } else if (err.code === 'EACCES') {
      console.error(`Нет доступа к директории: ${target}`);
    } else {
      console.error(`Ошибка при анализе директории: ${err.message}`);
    }
    process.exitCode = 1;
  }
}

main();
