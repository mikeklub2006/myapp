const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');
const mysqlPromise = require('mysql2/promise');
const { spawnSync } = require('child_process');
const { GROUP, getConfig } = require('./db');

const BIG_ROWS = 100000;
const POOL_LOG = path.join(__dirname, 'pool-errors.log');
const CRITICAL = ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'ECONNREFUSED'];

let pool = null;
let poolGeneration = 0;

function logPoolError(err) {
  const line = `[${new Date().toISOString()}] [${GROUP}] ${err.code}: ${err.message}\n`;
  fs.appendFileSync(POOL_LOG, line);
}

function createPool() {
  poolGeneration++;
  const core = mysql.createPool(getConfig({ connectionLimit: 10 }));

  // сам пул ошибку не генерирует, поэтому пробрасываем ошибки соединений в пул
  core.on('connection', (conn) => {
    conn.on('error', (err) => core.emit('error', err));
  });

  core.on('error', (err) => {
    console.log(`[POOL ERROR] ${err.code}`);
    logPoolError(err);
    if (err.fatal || CRITICAL.includes(err.code)) {
      recreatePool();
    }
  });

  pool = core.promise();
  return pool;
}

function recreatePool() {
  console.log('[POOL] Пересоздание пула...');
  const old = pool;
  createPool();
  old.end().catch(() => {});
}

async function tryConnect(title, config) {
  try {
    const conn = await mysqlPromise.createConnection(config);
    await conn.end();
    console.log(`${title}: подключение прошло`);
  } catch (err) {
    return err;
  }
  return null;
}

async function demoErrors() {
  console.log('=== Демонстрация ошибок ===');

  let err = await tryConnect('Неверный порт', getConfig({ port: 9999 }));
  if (err) console.log(`[${err.code}] Сервер недоступен: localhost:9999`);

  err = await tryConnect('Несуществующий хост', getConfig({ host: 'no-such-host.invalid', connectTimeout: 3000 }));
  if (err) console.log(`[${err.code}] Не удалось подключиться к несуществующему хосту no-such-host.invalid`);

  err = await tryConnect('Неверный пароль', getConfig({ password: 'wrong' }));
  if (err) console.log(`[${err.code}] Неверный пароль для пользователя ${getConfig().user}`);

  await pool.query('DROP TABLE IF EXISTS marks_demo');
  await pool.query('DROP TABLE IF EXISTS tx_demo');
  await pool.query(`
    CREATE TABLE tx_demo (
      id INT PRIMARY KEY,
      name VARCHAR(100) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE marks_demo (
      id INT PRIMARY KEY AUTO_INCREMENT,
      student_id INT NOT NULL,
      mark INT,
      FOREIGN KEY (student_id) REFERENCES tx_demo(id)
    ) ENGINE=InnoDB
  `);
  await pool.execute('INSERT INTO tx_demo (id, name) VALUES (?, ?)', [1, 'Михаил']);

  const cases = [
    { sql: 'SELECT * FRM tx_demo', params: [], text: 'Синтаксическая ошибка: SELECT * FRM tx_demo' },
    { sql: 'INSERT INTO tx_demo (id, name) VALUES (?, ?)', params: [1, 'Дубликат'], text: 'Дублирование ключа: id=1' },
    { sql: 'INSERT INTO tx_demo (id, name) VALUES (?, ?)', params: [2, null], text: 'NULL в NOT NULL столбце: name' },
    { sql: 'INSERT INTO marks_demo (student_id, mark) VALUES (?, ?)', params: [777, 5], text: 'Нарушение внешнего ключа: student_id=777' }
  ];

  for (const c of cases) {
    try {
      await pool.execute(c.sql, c.params);
      console.log(`Запрос выполнился без ошибки: ${c.sql}`);
    } catch (e) {
      console.log(`[${e.code}] ${c.text} (errno ${e.errno})`);
    }
  }
}

async function demoPoolErrors() {
  console.log('\n=== Обработка ошибок пула ===');
  const generation = poolGeneration;

  const conn = await pool.getConnection();
  const threadId = conn.threadId;
  conn.release();
  console.log(`В пуле простаивает соединение threadId=${threadId}, убиваем его на сервере`);

  const admin = await mysqlPromise.createConnection(getConfig());
  await admin.query(`KILL ${threadId}`);
  await admin.end();

  await new Promise((resolve) => setTimeout(resolve, 300));

  if (poolGeneration > generation) {
    const [[row]] = await pool.query('SELECT CONNECTION_ID() AS id');
    console.log(`[POOL] Новый пул работает, threadId=${row.id}`);
    console.log(`Ошибки записаны в ${path.basename(POOL_LOG)}`);
  } else {
    console.log('[POOL] Ошибка не пришла');
  }
}

async function prepareBigData() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS big_data (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(50) NOT NULL,
      group_name VARCHAR(20) NOT NULL,
      value INT NOT NULL,
      note VARCHAR(100)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  const [[{ cnt }]] = await pool.query('SELECT COUNT(*) AS cnt FROM big_data');
  if (cnt === BIG_ROWS) return;

  console.log(`Генерация ${BIG_ROWS} записей в big_data...`);
  await pool.query('TRUNCATE TABLE big_data');
  const batch = 1000;
  for (let i = 0; i < BIG_ROWS; i += batch) {
    const rows = [];
    for (let j = 1; j <= batch; j++) {
      const n = i + j;
      rows.push([`Студент ${n}`, GROUP, (n * 401) % 1000, `Запись номер ${n} для группы ${GROUP}`]);
    }
    await pool.query('INSERT INTO big_data (name, group_name, value, note) VALUES ?', [rows]);
  }
}

function heapMb() {
  return process.memoryUsage().heapUsed / 1024 / 1024;
}

function streamBigData() {
  return new Promise((resolve, reject) => {
    global.gc();
    const base = heapMb();
    let peak = 0;
    let count = 0;
    let sum = 0;
    const marks = [10, 50, 100];
    const start = Date.now();

    // .stream() есть только у обычного (не promise) пула
    const stream = pool.pool.query('SELECT * FROM big_data').stream({ highWaterMark: 1000 });

    stream.on('data', (row) => {
      count++;
      sum += row.value;
      if (count % 5000 === 0) {
        global.gc();
        peak = Math.max(peak, heapMb() - base);
      }
      const percent = (count / BIG_ROWS) * 100;
      if (percent === marks[0]) {
        marks.shift();
        console.log(`[STREAM] Получено: ${count} (${percent}%)`);
      }
    });
    stream.on('error', reject);
    stream.on('end', () => {
      resolve({ count, sum, time: (Date.now() - start) / 1000, memory: peak });
    });
  });
}

async function selectAll() {
  global.gc();
  const base = heapMb();
  const start = Date.now();
  const [rows] = await pool.query('SELECT * FROM big_data');
  global.gc();
  return { count: rows.length, time: (Date.now() - start) / 1000, memory: heapMb() - base };
}

// замер памяти делаем в отдельном процессе с --expose-gc и ограничением кучи
function runMeasure(mode, heapLimit) {
  const args = ['--expose-gc'];
  if (heapLimit) args.push(`--max-old-space-size=${heapLimit}`);
  args.push(__filename, '--memory', mode);
  const child = spawnSync(process.execPath, args, { encoding: 'utf8' });

  let result = null;
  for (const line of child.stdout.split('\n')) {
    if (line.startsWith('RESULT ')) result = JSON.parse(line.slice(7));
    else if (line.trim()) console.log(line);
  }
  if (!result) {
    const oom = child.stderr.includes('heap out of memory');
    return { error: oom ? 'JavaScript heap out of memory' : child.stderr.split('\n')[0] };
  }
  return result;
}

async function memoryChild(mode) {
  createPool();
  try {
    const result = mode === 'stream' ? await streamBigData() : await selectAll();
    console.log('RESULT ' + JSON.stringify(result));
  } finally {
    await pool.end();
  }
}

async function demoStreaming() {
  console.log('\n=== Потоковый запрос ===');
  await prepareBigData();

  const limit = 24;
  console.log(`Чтение ${BIG_ROWS} записей (куча процесса ограничена ${limit} МБ)...`);
  const s = runMeasure('stream', limit);
  if (s.error) {
    console.log(`✖ Ошибка: ${s.error}`);
  } else {
    console.log(`✔ Обработано за ${s.time.toFixed(2)} сек, сумма value = ${s.sum}`);
    console.log(`Пик памяти (heap): ${s.memory.toFixed(1)} МБ`);
  }

  console.log('\nСравнение: SELECT целиком');
  const full = runMeasure('full', 0);
  console.log(`Без ограничения: получено ${full.count} записей, занято в куче ${full.memory.toFixed(1)} МБ`);
  const limited = runMeasure('full', limit);
  if (limited.error) {
    console.log(`С ограничением ${limit} МБ: ✖ Ошибка: ${limited.error}`);
    console.log(`  Требуется ~${Math.ceil(full.memory)} МБ памяти только под строки результата`);
  } else {
    console.log(`С ограничением ${limit} МБ: запрос выполнился`);
  }
}

async function runTransaction(title, rows) {
  console.log(`\n--- ${title} ---`);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    console.log('Начало транзакции');
    for (let i = 0; i < rows.length; i++) {
      try {
        await conn.execute('INSERT INTO tx_demo (id, name) VALUES (?, ?)', rows[i]);
        console.log(`✔ INSERT ${i + 1} выполнен (id=${rows[i][0]})`);
      } catch (err) {
        console.log(`✖ INSERT ${i + 1} не выполнен (${err.code === 'ER_DUP_ENTRY' ? 'дубликат' : err.code})`);
        throw err;
      }
    }
    await conn.commit();
    console.log('Commit выполнен');
  } catch (err) {
    await conn.rollback();
    console.log('Rollback выполнен');
  } finally {
    conn.release();
    console.log('Соединение возвращено в пул');
  }
  const [[{ cnt }]] = await pool.query('SELECT COUNT(*) AS cnt FROM tx_demo');
  console.log(`Записей в tx_demo: ${cnt}`);
}

async function demoTransactions() {
  console.log('\n=== Транзакция ===');
  await runTransaction('Успешная транзакция', [[10, 'Анна'], [11, 'Олег'], [12, 'Петр']]);
  await runTransaction('Транзакция с ошибкой', [[20, 'Мария'], [21, 'Иван'], [10, 'Дубликат']]);
}

async function main() {
  fs.writeFileSync(POOL_LOG, '');
  createPool();
  try {
    await demoErrors();
    await demoPoolErrors();
    await demoStreaming();
    await demoTransactions();
  } catch (err) {
    console.error(`✖ Непредвиденная ошибка [${err.code}]: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (process.argv[2] === '--memory') {
  memoryChild(process.argv[3]);
} else {
  main();
}
