const db = require('../src/db');
const migrate = require('../src/migrate');

async function main() {
  const database = await db.connect();
  const applied = await migrate(database);
  console.log(applied.length ? `Применены миграции: ${applied.join(', ')}` : 'Новых миграций нет');
  await db.close();
}

main().catch((err) => {
  console.error('Ошибка миграции:', err.message);
  process.exit(1);
});
