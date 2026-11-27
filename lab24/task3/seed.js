// генератор с фиксированным зерном (номер группы 401), чтобы данные были одинаковые при каждом запуске
function createRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const FIRST_NAMES = ['Иван', 'Мария', 'Петр', 'Анна', 'Олег', 'Елена', 'Сергей', 'Ольга', 'Дмитрий', 'Наталья', 'Алексей', 'Татьяна'];
const LAST_NAMES = ['Иванов', 'Петров', 'Сидоров', 'Смирнов', 'Кузнецов', 'Попов', 'Соколов', 'Лебедев', 'Козлов', 'Новиков'];
const LATIN = {
  'Иван': 'ivan', 'Мария': 'maria', 'Петр': 'petr', 'Анна': 'anna', 'Олег': 'oleg', 'Елена': 'elena',
  'Сергей': 'sergey', 'Ольга': 'olga', 'Дмитрий': 'dmitry', 'Наталья': 'natalya', 'Алексей': 'alexey', 'Татьяна': 'tatyana'
};
const GROUPS = ['401', '402', '403'];
const FEMALE = ['Мария', 'Анна', 'Елена', 'Ольга', 'Наталья', 'Татьяна'];

function generateUsers(count, seed = 401) {
  const random = createRandom(seed);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const users = [];

  for (let i = 1; i <= count; i++) {
    const first = pick(FIRST_NAMES);
    let last = pick(LAST_NAMES);
    if (FEMALE.includes(first)) last += 'а';

    users.push({
      name: `${first} ${last}`,
      email: `${LATIN[first]}.${i}@example.com`,
      group_name: pick(GROUPS),
      age: 17 + Math.floor(random() * 9),
      course: 1 + Math.floor(random() * 4),
      created_at: new Date(Date.UTC(2024, 0, 1) + i * 3600 * 1000)
    });
  }
  return users;
}

module.exports = { generateUsers };
