const fs = require('fs').promises;
const path = require('path');

const VARIANT = 8;
const FILE_NAME = `student_${VARIANT}.txt`;
const FILE_PATH = path.join('.', FILE_NAME);
const SEPARATOR = '─'.repeat(33);

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const d = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const t = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${d} ${t}`;
}

function buildContent() {
  const books = [
    '"Преступление и наказание" - Ф. Достоевский',
    '"Мастер и Маргарита" - М. Булгаков',
    '"Три товарища" - Э. М. Ремарк',
    '"Дюна" - Ф. Герберт',
    '"Зеленая миля" - С. Кинг'
  ];

  return [
    'Студент: Клубович Михаил',
    'Группа: 401',
    `Вариант: ${VARIANT}`,
    `Дата: ${formatDate(new Date())}`,
    'Любимые книги:',
    ...books.map((book, i) => `${i + 1}. ${book}`)
  ];
}

async function createFile() {
  const lines = buildContent();
  await fs.writeFile(FILE_PATH, lines.join('\n') + '\n', 'utf8');
  return lines.length;
}

async function addCounter(count) {
  await fs.appendFile(FILE_PATH, `Количество записей: ${count}\n`, 'utf8');
}

async function printFile() {
  const content = await fs.readFile(FILE_PATH, 'utf8');
  console.log('Содержимое файла:');
  console.log(SEPARATOR);
  console.log(content.trimEnd());
  console.log(SEPARATOR);
}

async function main() {
  try {
    const count = await createFile();
    console.log(`Создан файл: ${FILE_NAME}`);
    await addCounter(count);
    await printFile();
  } catch (err) {
    if (err.code === 'EACCES') {
      console.error('Нет прав на запись в текущую директорию');
    } else if (err.code === 'ENOSPC') {
      console.error('Недостаточно места на диске');
    } else {
      console.error(`Ошибка при работе с файлом: ${err.message}`);
    }
    process.exitCode = 1;
  }
}

main();
