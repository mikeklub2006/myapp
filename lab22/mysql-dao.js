const mysql = require('mysql2/promise');
const { GROUP, getConfig } = require('./db');
const { StudentDAO, ValidationError } = require('./StudentDAO');

const FIRST_NAMES = ['Иван', 'Мария', 'Петр', 'Анна', 'Алексей', 'Ольга', 'Дмитрий', 'Елена', 'Сергей', 'Наталья'];
const LAST_NAMES = ['Иванов', 'Петров', 'Сидоров', 'Смирнов', 'Кузнецов', 'Попов', 'Волков', 'Соколов', 'Лебедев', 'Козлов'];
const GROUPS = [GROUP, '402', '403'];

// простой линейный конгруэнтный генератор, seed = номер группы
function createRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function femaleSurname(first, last) {
  const female = ['Мария', 'Анна', 'Ольга', 'Елена', 'Наталья'].includes(first);
  return female ? last + 'а' : last;
}

function line(s) {
  const grade = s.grade === null ? 'NULL' : s.grade.toFixed(2);
  return `  id=${s.id}, name=${s.name}, group=${s.group_name}, course=${s.course}, grade=${grade}`;
}

async function seed(dao) {
  await dao.clear();
  const random = createRandom(Number(GROUP));
  for (let i = 0; i < 99; i++) {
    const first = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)];
    await dao.create({
      name: `${first} ${femaleSurname(first, last)}`,
      group_name: GROUPS[Math.floor(random() * GROUPS.length)],
      course: 1 + Math.floor(random() * 4),
      grade: Math.round((2.5 + random() * 2.5) * 100) / 100
    });
  }
}

async function tryCreate(dao, data) {
  try {
    const s = await dao.create(data);
    console.log(`✔ Создан: id=${s.id}, name=${s.name}`);
    return s;
  } catch (err) {
    if (err instanceof ValidationError) {
      console.log(`✖ Ошибка: ${err.message}`);
      return null;
    }
    throw err;
  }
}

async function main() {
  const pool = mysql.createPool(getConfig({ connectionLimit: 10, decimalNumbers: true }));
  const dao = new StudentDAO(pool);

  try {
    await dao.init();
    await seed(dao);

    console.log(`=== StudentDAO (группа ${GROUP}) ===\n`);

    console.log('--- Создание с валидацией ---');
    const me = await tryCreate(dao, { name: 'Михаил Клубович', group_name: GROUP, course: 3, grade: 4.5 });
    await tryCreate(dao, { name: 'М', group_name: GROUP, course: 3, grade: 4 });
    await tryCreate(dao, { name: 'Иван Петров', group_name: 'ББМО-01-23', course: 2, grade: 4 });
    await tryCreate(dao, { name: 'Иван Петров', group_name: GROUP, course: 7, grade: 4 });
    await tryCreate(dao, { name: 'Иван Петров', group_name: GROUP, course: 2, grade: 6 });
    await tryCreate(dao, { group_name: GROUP, course: 2 });

    console.log('\n--- Пагинация ---');
    for (const offset of [0, 5]) {
      const res = await dao.findAll({ limit: 5, offset });
      console.log(`findAll({ limit: 5, offset: ${offset} }):`);
      console.log(`  Всего: ${res.total}, Страница: ${res.page}/${res.pages}`);
      res.data.forEach((s) => console.log(line(s)));
    }

    console.log('\n--- Сортировка ---');
    for (const sort of ['name_asc', 'name_desc', 'grade_desc', 'grade_asc', 'created_at_desc']) {
      const res = await dao.findAll({ limit: 3, sort });
      console.log(`findAll({ limit: 3, sort: '${sort}' }):`);
      res.data.forEach((s) => console.log(line(s)));
    }

    console.log('\n--- Фильтры ---');
    const filters = [
      { group_name: GROUP },
      { group_name: GROUP, course: 2 },
      { grade_min: 4.0, grade_max: 5.0 },
      { group_name: GROUP, course: 3, grade_min: 4.0, sort: 'grade_desc', limit: 3 }
    ];
    for (const f of filters) {
      const res = await dao.findAll(f);
      console.log(`findAll(${JSON.stringify(f)}):`);
      console.log(`  Найдено: ${res.total}`);
      if (f.limit) res.data.forEach((s) => console.log(line(s)));
    }

    console.log('\n--- Поиск ---');
    for (const q of ['Иван', 'Клубович', '%']) {
      const found = await dao.search(q);
      console.log(`search('${q}'):`);
      console.log(`  Найдено: ${found.length}`);
      found.slice(0, 5).forEach((s) => console.log(`  id=${s.id}, name=${s.name}`));
      if (found.length > 5) console.log('  ...');
    }

    console.log('\n--- Обновление и удаление ---');
    const updated = await dao.update(me.id, { grade: 4.9 });
    console.log(`update(${me.id}, { grade: 4.9 }):`);
    console.log(line(updated));
    try {
      await dao.update(me.id, { group_name: '4-01' });
    } catch (err) {
      console.log(`update(${me.id}, { group_name: '4-01' }): ✖ ${err.message}`);
    }
    console.log(`update(9999, { grade: 3 }): ${await dao.update(9999, { grade: 3 })}`);
    console.log(`findById(${me.id}): ${(await dao.findById(me.id)).name}`);
    const victim = (await dao.findAll({ limit: 1, sort: 'grade_asc' })).data[0];
    console.log(`delete(${victim.id}): ${await dao.delete(victim.id)}`);
    console.log(`delete(${victim.id}) повторно: ${await dao.delete(victim.id)}`);
    console.log(`findById(${victim.id}): ${await dao.findById(victim.id)}`);
    // возвращаем общее количество к 100
    await dao.create({ name: 'Анна Волкова', group_name: GROUP, course: 1, grade: null });

    console.log('\n--- Статистика ---');
    const stats = await dao.getStats();
    console.log(`Всего студентов:      ${stats.total}`);
    console.log(`Средний балл:         ${stats.averageGrade.toFixed(2)}`);
    console.log(`Минимальная оценка:   ${stats.minGrade.toFixed(2)}`);
    console.log(`Максимальная оценка:  ${stats.maxGrade.toFixed(2)}`);
    console.log('\nПо группам:');
    Object.entries(stats.byGroup).forEach(([g, n]) => console.log(`  ${g}: ${n}`));
    console.log('\nПо курсам:');
    Object.entries(stats.byCourse).forEach(([c, n]) => console.log(`  ${c} курс: ${n}`));
  } catch (err) {
    console.error(`✖ Ошибка [${err.code || err.name}]: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
