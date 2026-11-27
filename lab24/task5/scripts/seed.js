const db = require('../src/db');
const migrate = require('../src/migrate');
const User = require('../src/models/user');
const { generateUsers } = require('../src/utils/generateUsers');

async function seed(count = 100) {
  if (await User.count({}, true) > 1) return 0;
  return User.insertMany(generateUsers(count));
}

async function main() {
  const count = Number(process.argv[2]) || 100;
  const database = await db.connect();
  await migrate(database);
  const inserted = await seed(count);
  console.log(inserted ? `Добавлено пользователей: ${inserted}` : 'Коллекция уже заполнена, seed пропущен');
  await db.close();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Ошибка seed:', err.message);
    process.exit(1);
  });
}

module.exports = seed;
