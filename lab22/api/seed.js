const mysql = require('mysql2/promise');
const config = require('./config');
const { migrate } = require('./migrations/migrate');

const FIRST_NAMES = ['Иван', 'Мария', 'Петр', 'Анна', 'Алексей', 'Ольга', 'Дмитрий', 'Елена', 'Сергей', 'Олег'];
const GROUPS = ['401', '402', '403'];
const COUNT = 100;

function createRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

async function seed() {
  await migrate();
  const conn = await mysql.createConnection(config.db);
  try {
    const random = createRandom(Number(config.group));
    await conn.query('DELETE FROM students');
    await conn.query('ALTER TABLE students AUTO_INCREMENT = 1');
    await conn.query('INSERT IGNORE INTO student_groups (name) VALUES ?', [GROUPS.map((g) => [g])]);

    const rows = [['Михаил Клубович', config.group, 3, 4.5]];
    for (let i = 1; i < COUNT; i++) {
      rows.push([
        FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)],
        GROUPS[Math.floor(random() * GROUPS.length)],
        1 + Math.floor(random() * 4),
        Math.round((2.5 + random() * 2.5) * 10) / 10
      ]);
    }
    await conn.query('INSERT INTO students (name, group_name, course, grade) VALUES ?', [rows]);
    console.log(`[SEED] Добавлено студентов: ${rows.length}, групп: ${GROUPS.length}`);
  } finally {
    await conn.end();
  }
}

seed().catch((err) => {
  console.error(`[SEED] Ошибка: ${err.message}`);
  process.exitCode = 1;
});
