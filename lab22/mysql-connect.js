const mysql = require('mysql2/promise');
const { getConfig, describeError } = require('./db');

const POOL_LIMIT = 10;

async function singleConnection() {
  console.log('=== Одиночное соединение ===');
  let connection;
  try {
    connection = await mysql.createConnection(getConfig());
    console.log('✔ Подключение установлено');
    console.log(`ID соединения: ${connection.threadId}`);

    const [rows] = await connection.query('SELECT VERSION() AS version, DATABASE() AS db, CURRENT_USER() AS user');
    console.log(`Версия MySQL: ${rows[0].version}`);
    console.log(`Текущая БД: ${rows[0].db}`);
    console.log(`Пользователь: ${rows[0].user}`);
  } catch (err) {
    console.log(`✖ [${err.code}] ${describeError(err)}`);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✖ Соединение закрыто');
    }
  }
}

async function poolConnection() {
  console.log('\n=== Пул соединений ===');
  const pool = mysql.createPool(getConfig({ connectionLimit: POOL_LIMIT, waitForConnections: true }));

  let created = 0;
  pool.on('connection', () => created++);

  try {
    console.log(`✔ Пул создан (лимит: ${POOL_LIMIT})`);

    const [rows] = await pool.query('SELECT VERSION() AS version, DATABASE() AS db');
    console.log(`Версия MySQL: ${rows[0].version}`);
    console.log(`Текущая БД: ${rows[0].db}`);
    console.log(`Открыто соединений после первого запроса: ${created}`);

    // пул создаёт соединения лениво, поэтому берём сразу все 10
    const connections = await Promise.all(
      Array.from({ length: POOL_LIMIT }, () => pool.getConnection())
    );
    const ids = connections.map((c) => c.threadId);
    connections.forEach((c) => c.release());
    console.log(`Соединений в пуле: ${created} (threadId: ${ids.join(', ')})`);

    const [again] = await pool.query('SELECT 1 + 1 AS result');
    console.log(`Повторный запрос через пул: 1 + 1 = ${again[0].result}, новых соединений не создано: ${created === POOL_LIMIT}`);
    console.log('✔ Пул готов к работе');
  } catch (err) {
    console.log(`✖ [${err.code}] ${describeError(err)}`);
  } finally {
    await pool.end();
  }
}

async function connectionErrors() {
  console.log('\n=== Ошибки подключения ===');

  const cases = [
    { title: 'Неверный пароль', config: getConfig({ password: 'wrong_password' }) },
    { title: 'Неверный порт', config: getConfig({ port: 9999 }) }
  ];

  for (const item of cases) {
    try {
      const connection = await mysql.createConnection(item.config);
      await connection.end();
      console.log(`${item.title}: подключение неожиданно прошло`);
    } catch (err) {
      console.log(`${item.title}: ✖ [${err.code}] ${describeError(err, item.config)}`);
    }
  }
}

async function main() {
  await singleConnection();
  await poolConnection();
  await connectionErrors();
}

main();
