const GROUP = '401';
const GROUPS = ['401', '402', '403'];

const FIRST_NAMES = ['Иван', 'Мария', 'Петр', 'Анна', 'Олег', 'Елена', 'Михаил', 'Ольга', 'Сергей', 'Дарья',
  'Алексей', 'Наталья', 'Дмитрий', 'Ксения', 'Андрей', 'Татьяна', 'Никита', 'Юлия', 'Артем', 'Светлана'];
const LAST_NAMES = ['Иванов', 'Петров', 'Сидоров', 'Смирнов', 'Кузнецов', 'Попов', 'Волков', 'Соколов',
  'Козлов', 'Новиков', 'Морозов', 'Лебедев', 'Егоров', 'Павлов', 'Клубович', 'Орлов'];

// генератор mulberry32, сид берем из номера группы, чтобы данные были одинаковые при каждом запуске
function createRandom(seed = 401) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

function fullName(random) {
  const first = pick(random, FIRST_NAMES);
  let last = pick(random, LAST_NAMES);
  // женские фамилии
  if (/[аяь]$/.test(first) && first !== 'Никита' && /ов$/.test(last)) last += 'а';
  return `${first} ${last}`;
}

function makeStudent(random, i, group) {
  return {
    name: fullName(random),
    email: `student${i}@bbmo.local`,
    group_name: group || pick(random, GROUPS),
    course: 1 + Math.floor(random() * 4),
    grade: Math.round((2 + random() * 3) * 10) / 10,
    created_at: new Date()
  };
}

module.exports = { GROUP, GROUPS, createRandom, pick, fullName, makeStudent };
