require('dotenv').config();
const { MongoClient } = require('mongodb');

const DEFAULT_URI = 'mongodb://student:password@localhost:27017/bbmo_401';
const BAD_URI = 'mongodb://student:wrongpass@localhost:27017/bbmo_401';
const HEARTBEAT_SECONDS = Number(process.env.HEARTBEAT_SECONDS) || 7;

const useBadUri = process.argv.includes('--bad');
const uri = useBadUri ? BAD_URI : (process.env.MONGO_URI || DEFAULT_URI);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function singleConnection() {
  // одиночное подключение: directConnection, без обнаружения остальных узлов
  const client = new MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 3000 });
  await client.connect();
  await client.db().command({ ping: 1 });
  const hello = await client.db().command({ hello: 1 });
  console.log('Одиночное подключение (directConnection=true):');
  console.log(`  тип топологии: Single, узел: ${hello.me}`);
  await client.close();
}

async function main() {
  console.log('=== Подключение к MongoDB ===');

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 3000,
    heartbeatFrequencyMS: 2000,
    serverMonitoringMode: 'poll'
  });

  let topologyType = '';
  let failed = false;
  let heartbeats = 0;

  client.on('topologyDescriptionChanged', (event) => {
    topologyType = event.newDescription.type;
  });

  try {
    await client.connect();
  } catch (err) {
    console.log(`✖ Ошибка подключения: ${err.message}`);
    console.log(`  URI: ${uri.replace(/:[^:@/]+@/, ':****@')}`);
    process.exitCode = 1;
    await client.close();
    return;
  }

  const dbName = process.env.DB_NAME || client.options.dbName;
  const db = client.db(dbName);
  await db.command({ ping: 1 });
  const info = await db.admin().command({ buildInfo: 1 });

  console.log('✔ Подключение установлено');
  console.log(`Версия MongoDB: ${info.version}`);
  console.log(`База данных: ${db.databaseName}`);
  console.log(`Пользователь: ${client.options.credentials.username}`);

  console.log('\nMongoClient (пул соединений, обнаружение узлов):');
  console.log(`  тип топологии: ${topologyType}`);
  await singleConnection();

  console.log('\n=== Информация о сервере ===');
  const { databases } = await db.admin().listDatabases({ nameOnly: true });
  console.log('Список БД:');
  databases.forEach((d) => console.log(`  - ${d.name}`));

  const collections = await db.listCollections().toArray();
  console.log(`\nКоллекции в ${db.databaseName}:`);
  if (collections.length === 0) {
    console.log('  (пусто - БД создана лениво)');
  } else {
    collections.forEach((c) => console.log(`  - ${c.name}`));
  }

  console.log('\n=== Heartbeat ===');
  client.on('serverHeartbeatSucceeded', () => {
    heartbeats++;
    if (failed) {
      console.log(`[HEARTBEAT] Связь восстановлена: ${new Date().toISOString()}`);
      failed = false;
    } else {
      console.log(`[HEARTBEAT] Успешно: ${new Date().toISOString()}`);
    }
  });
  client.on('serverHeartbeatFailed', (event) => {
    failed = true;
    console.log(`[HEARTBEAT] Ошибка: ${new Date().toISOString()} (${event.failure.message})`);
  });

  // если за это время остановить и снова запустить сервер, драйвер переподключится сам
  await sleep(HEARTBEAT_SECONDS * 1000);

  try {
    await db.command({ ping: 1 });
    console.log(failed ? '✖ Сервер недоступен' : `✔ Соединение стабильно (heartbeat: ${heartbeats})`);
  } catch (err) {
    console.log(`✖ ping не прошел: ${err.message}`);
  }

  await client.close();
  console.log('\n✖ Соединение закрыто');
}

main().catch((err) => {
  console.error('Ошибка:', err.message);
  process.exit(1);
});
