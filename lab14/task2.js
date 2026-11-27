const fs = require('fs').promises;
const path = require('path');

const VARIANT = 8;
const ROOT = path.join('.', `project_${VARIANT}`);

// описание каждой папки попадает в её info.txt
const FOLDERS = {
  '.': 'Корневой каталог учебного проекта',
  'src': 'Исходный код приложения',
  'src/modules': 'Логические модули приложения',
  'src/components': 'Компоненты пользовательского интерфейса',
  'src/utils': 'Вспомогательные функции и хелперы',
  'data': 'Каталог для данных',
  'data/input': 'Входные данные для обработки',
  'data/output': 'Результаты работы программы',
  'temp': 'Временные файлы'
};

function currentDate() {
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function createStructure() {
  for (const [folder, description] of Object.entries(FOLDERS)) {
    const dir = path.join(ROOT, folder);
    await fs.mkdir(dir, { recursive: true });

    const info = `Папка: ${path.join(`project_${VARIANT}`, folder === '.' ? '' : folder)}\n` +
      `Назначение: ${description}\n` +
      `Вариант: ${VARIANT}\n`;
    await fs.writeFile(path.join(dir, 'info.txt'), info, 'utf8');

    // вариант 8 - четный, поэтому в каждой папке нужен README.md с датой
    const readme = `# ${folder === '.' ? `project_${VARIANT}` : path.basename(folder)}\n\n` +
      `${description}\n\nСоздано: ${currentDate()}\n`;
    await fs.writeFile(path.join(dir, 'README.md'), readme, 'utf8');
  }
}

async function printTree(dir, prefix = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (let i = 0; i < entries.length; i++) {
    const isLast = i === entries.length - 1;
    const marker = isLast ? '└── ' : '├── ';
    const entry = entries[i];
    console.log(prefix + marker + entry.name + (entry.isDirectory() ? '/' : ''));

    if (entry.isDirectory()) {
      await printTree(path.join(dir, entry.name), prefix + (isLast ? '    ' : '│   '));
    }
  }
}

async function showTree(title) {
  console.log(`\n${title}`);
  console.log(`${path.basename(ROOT)}/`);
  await printTree(ROOT);
}

async function main() {
  try {
    // чистим прошлый запуск, чтобы rename не падал с EEXIST
    await fs.rm(ROOT, { recursive: true, force: true });

    await createStructure();
    console.log(`Создана структура каталогов: ${ROOT}`);
    await showTree('Дерево структуры:');

    await fs.rename(path.join(ROOT, 'temp'), path.join(ROOT, 'data', 'temp'));
    console.log('\nПапка temp перемещена в data');

    await fs.rename(path.join(ROOT, 'data', 'output'), path.join(ROOT, 'data', 'results'));
    console.log('Папка data/output переименована в data/results');

    await fs.rm(path.join(ROOT, 'data', 'temp'), { recursive: true, force: true });
    console.log('Папка temp удалена со всем содержимым');

    await showTree('Обновленное дерево структуры:');
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`Каталог или файл не найден: ${err.path}`);
    } else if (err.code === 'EPERM' || err.code === 'EACCES') {
      console.error('Недостаточно прав для операции с каталогом');
    } else {
      console.error(`Ошибка при работе с каталогами: ${err.message}`);
    }
    process.exitCode = 1;
  }
}

main();
