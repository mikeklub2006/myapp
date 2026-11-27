const mysql = require('mysql2/promise');
const { GROUP, getConfig } = require('./db');

const pool = mysql.createPool(getConfig({ connectionLimit: 10 }));

function printStudents(rows, withGroup = true) {
  for (const s of rows) {
    const group = withGroup ? `, group=${s.group_name}` : '';
    console.log(`  id=${s.id}, name=${s.name}${group}, grade=${s.grade}`);
  }
}

async function createTable() {
  console.log('=== Создание таблицы ===');
  await pool.query('DROP TABLE IF EXISTS students_copy');
  await pool.query('DROP TABLE IF EXISTS students');
  await pool.query(`
    CREATE TABLE students (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      group_name VARCHAR(20) NOT NULL,
      course INT NOT NULL,
      grade DECIMAL(3,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✔ Таблица students создана\n');
}

async function insertStudents() {
  console.log('=== INSERT ===');
  const [one] = await pool.execute(
    'INSERT INTO students (name, group_name, course, grade) VALUES (?, ?, ?, ?)',
    ['Михаил', GROUP, 3, 4.5]
  );
  console.log(`✔ Вставлен студент: id=${one.insertId}, affectedRows=${one.affectedRows}`);

  const rows = [
    ['Мария', GROUP, 3, 3.8],
    ['Петр', GROUP, 3, 4.2],
    ['Анна', '402', 2, 4.9]
  ];
  const [many] = await pool.query('INSERT INTO students (name, group_name, course, grade) VALUES ?', [rows]);
  console.log(`✔ Вставлено ${rows.length} студента: affectedRows=${many.affectedRows}, первый insertId=${many.insertId}\n`);
}

async function selectStudents() {
  console.log('=== SELECT ===');
  const [all] = await pool.query('SELECT * FROM students');
  console.log('Все студенты:');
  printStudents(all);

  const [byGroup] = await pool.execute(
    'SELECT id, name, grade FROM students WHERE group_name = ? ORDER BY grade DESC',
    [GROUP]
  );
  console.log(`\nСтуденты группы ${GROUP} (сортировка по grade):`);
  printStudents(byGroup, false);

  const limit = 2;
  for (let page = 1; page <= 2; page++) {
    const offset = (page - 1) * limit;
    // для LIMIT в execute() нужны строки, поэтому тут query()
    const [rows] = await pool.query('SELECT * FROM students ORDER BY id LIMIT ? OFFSET ?', [limit, offset]);
    console.log(`\nСтраница ${page} (LIMIT ${limit} OFFSET ${offset}):`);
    printStudents(rows);
  }
  console.log();
}

async function updateStudent() {
  console.log('=== UPDATE ===');
  const [first] = await pool.execute('UPDATE students SET grade = ? WHERE id = ?', [4.8, 1]);
  console.log(`✔ Обновлён студент id=1: affectedRows=${first.affectedRows}, changedRows=${first.changedRows}`);

  const [second] = await pool.execute('UPDATE students SET grade = ? WHERE id = ?', [4.8, 1]);
  console.log(`✔ Повторное обновление: affectedRows=${second.affectedRows}, changedRows=${second.changedRows}`);
  console.log('  (строка найдена, но значение не изменилось)\n');
}

async function deleteStudents() {
  console.log('=== DELETE ===');
  const [one] = await pool.execute('DELETE FROM students WHERE id = ?', [1]);
  console.log(`✔ Удалён студент id=1: affectedRows=${one.affectedRows}`);

  const [none] = await pool.execute('DELETE FROM students WHERE id = ?', [999]);
  console.log(`Удаление несуществующего id=999: affectedRows=${none.affectedRows}`);

  const [group] = await pool.execute('DELETE FROM students WHERE group_name = ?', ['402']);
  console.log(`✔ Удалены все студенты группы 402: affectedRows=${group.affectedRows}`);

  const [[count]] = await pool.query('SELECT COUNT(*) AS cnt FROM students');
  console.log(`Осталось студентов: ${count.cnt}\n`);
}

async function sqlInjection() {
  console.log('=== Защита от SQL-инъекции ===');

  const login = "' OR '1'='1";
  const unsafe = `SELECT * FROM students WHERE name = '${login}'`;
  const [leak] = await pool.query(unsafe);
  console.log(`Ввод пользователя: "${login}"`);
  console.log(`Конкатенация: ${unsafe}`);
  console.log(`✖ Вернулись все записи: ${leak.length}`);
  const [safeRows] = await pool.execute('SELECT * FROM students WHERE name = ?', [login]);
  console.log(`✔ С плейсхолдером: ${safeRows.length} записей\n`);

  // после -- обязательно нужен пробел, иначе это не комментарий
  const attack = "'; DROP TABLE students_copy; -- ";
  console.log(`Попытка инъекции: "${attack}"`);

  // ломать будем копию таблицы, чтобы не потерять данные
  await pool.query('CREATE TABLE students_copy AS SELECT * FROM students');

  const [rows] = await pool.execute('SELECT * FROM students_copy WHERE name = ?', [attack]);
  const [[exists]] = await pool.query("SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'students_copy'");
  console.log(`✔ Параметризованный запрос безопасен: найдено ${rows.length} записей, таблица на месте: ${exists.cnt === 1}`);

  // multipleStatements по умолчанию выключен, включаем только для демонстрации
  const conn = await mysql.createConnection(getConfig({ multipleStatements: true }));
  const sql = `SELECT * FROM students_copy WHERE name = '${attack}'`;
  console.log(`Конкатенация: ${sql}`);
  try {
    await conn.query(sql);
  } finally {
    await conn.end();
  }
  const [[after]] = await pool.query("SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'students_copy'");
  if (after.cnt === 0) {
    console.log('✖ Конкатенация привела к удалению таблицы students_copy');
  }
}

async function main() {
  try {
    await createTable();
    await insertStudents();
    await selectStudents();
    await updateStudent();
    await deleteStudents();
    await sqlInjection();
  } catch (err) {
    console.error(`✖ Ошибка [${err.code}]: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
