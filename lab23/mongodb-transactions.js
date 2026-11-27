require('dotenv').config();
const { MongoClient, ReadPreference } = require('mongodb');
const { GROUP } = require('./generator');

const uri = process.env.MONGO_URI || 'mongodb://student:password@localhost:27017/bbmo_401';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function replicaSet(db) {
  console.log('=== Реплика-сет ===');
  const status = await db.admin().command({ replSetGetStatus: 1 });
  const primary = status.members.find((m) => m.stateStr === 'PRIMARY');
  const secondaries = status.members.filter((m) => m.stateStr === 'SECONDARY');

  console.log(`✔ Реплика-сет: ${status.set}`);
  console.log(`✔ Primary: ${primary.name}`);
  console.log(`✔ Вторичные: ${secondaries.length ? secondaries.map((m) => m.name).join(', ') : 'нет (один узел)'}`);
}

async function successTransaction(client, students) {
  console.log('\n=== Транзакция (успех) ===');
  const session = client.startSession();
  console.log('[SESSION] Начало');
  try {
    session.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    console.log('[BEGIN] Транзакция начата');

    const ivan = await students.insertOne(
      { name: 'Иван', email: 'ivan@bbmo.local', group_name: GROUP, grade: 4.5 },
      { session }
    );
    console.log('[INSERT] Студент 1: Иван');

    await students.insertOne({ name: 'Мария', email: 'maria@bbmo.local', group_name: GROUP, grade: 4.1 }, { session });
    console.log('[INSERT] Студент 2: Мария');

    await students.updateOne({ _id: ivan.insertedId }, { $set: { grade: 4.8 } }, { session });
    console.log('[UPDATE] Студент 1: grade=4.8');

    // mvcc: вне сессии незафиксированные изменения не видны
    const outside = await students.countDocuments();
    const inside = await students.countDocuments({}, { session });
    console.log(`[MVCC] Внутри транзакции видно ${inside} документа, снаружи - ${outside}`);

    await session.commitTransaction();
    console.log('[COMMIT] Транзакция зафиксирована');
  } catch (err) {
    await session.abortTransaction();
    console.log(`[ABORT] ${err.message}`);
  } finally {
    await session.endSession();
  }

  const saved = await students.find({}, { projection: { _id: 0, name: 1, grade: 1 } }).toArray();
  console.log(`✔ Данные сохранены: ${saved.map((s) => `${s.name} (${s.grade})`).join(', ')}`);
}

async function failedTransaction(client, students) {
  console.log('\n=== Транзакция (откат) ===');
  const session = client.startSession();
  try {
    session.startTransaction();
    console.log('[BEGIN] Транзакция начата');

    await students.insertOne({ name: 'Петр', email: 'petr@bbmo.local', group_name: GROUP, grade: 3.9 }, { session });
    console.log('[INSERT] Студент 3: Петр');

    try {
      await students.insertOne({ name: 'Петр', email: 'petr@bbmo.local', group_name: GROUP, grade: 3.9 }, { session });
    } catch (err) {
      console.log(`[INSERT] Студент 3 (дубликат): ✖ ${err.code === 11000 ? 'E11000 duplicate key (email)' : err.message}`);
      throw err;
    }

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    console.log('[ABORT] Транзакция отменена');
  } finally {
    await session.endSession();
  }

  const count = await students.countDocuments();
  const petr = await students.findOne({ name: 'Петр' });
  console.log(petr ? '✖ Данные сохранились' : '✔ Данные не сохранены');
  console.log(`Проверка: студентов в БД = ${count} (${petr ? 'Петр добавлен' : 'Петр не добавлен'})`);
}

async function changeStreams(students) {
  console.log('\n=== Change Streams ===');
  const stream = students.watch([], { fullDocument: 'updateLookup' });
  console.log('[WATCH] Отслеживание коллекции students');

  const listener = (async () => {
    for await (const change of stream) {
      const id = String(change.documentKey._id).slice(-6);
      if (change.operationType === 'insert') {
        console.log(`[CHANGE] insert: { name: "${change.fullDocument.name}" }`);
      } else if (change.operationType === 'update') {
        const fields = Object.entries(change.updateDescription.updatedFields).map(([k, v]) => `${k}: ${v}`);
        console.log(`[CHANGE] update: { _id: ${id}, ${fields.join(', ')} }`);
      } else if (change.operationType === 'replace') {
        console.log(`[CHANGE] replace: { _id: ${id}, name: "${change.fullDocument.name}" }`);
      } else if (change.operationType === 'delete') {
        console.log(`[CHANGE] delete: { _id: ${id} }`);
      } else {
        console.log(`[CHANGE] ${change.operationType}`);
      }
    }
  })().catch((err) => {
    if (!stream.closed) console.log(`[WATCH] Ошибка: ${err.message}`);
  });

  // поток открывается асинхронно, даем ему время
  await sleep(500);

  const anna = await students.insertOne({ name: 'Анна', email: 'anna@bbmo.local', group_name: GROUP, grade: 4.0 });
  await sleep(200);
  await students.updateOne({ _id: anna.insertedId }, { $set: { grade: 5.0 } });
  await sleep(200);
  await students.replaceOne({ _id: anna.insertedId }, { name: 'Анна Смирнова', email: 'anna@bbmo.local', group_name: GROUP, grade: 5.0 });
  await sleep(200);
  await students.deleteOne({ _id: anna.insertedId });
  await sleep(1000);

  await stream.close();
  await listener;
  console.log('[WATCH] Stream закрыт');
}

async function readPreference(client) {
  console.log('\n=== Read Preference ===');
  const modes = ['primary', 'primaryPreferred', 'secondary', 'secondaryPreferred', 'nearest'];

  for (const mode of modes) {
    const collection = client.db(process.env.DB_NAME).collection('students', {
      readPreference: new ReadPreference(mode)
    });
    const start = process.hrtime.bigint();
    try {
      await collection.find({}).maxTimeMS(1000).toArray();
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const note = mode.startsWith('secondary') ? ' (вторичных нет, читаем с primary)' : '';
      console.log(`${(mode + ':').padEnd(20)} ${ms.toFixed(1)} мс${note}`);
    } catch (err) {
      console.log(`${(mode + ':').padEnd(20)} ✖ ${err.message.split('.')[0]}`);
    }
  }
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const students = db.collection('students');

  await students.drop().catch(() => {});
  await db.createCollection('students');
  await students.createIndex({ email: 1 }, { unique: true });

  await replicaSet(db);
  await successTransaction(client, students);
  await failedTransaction(client, students);
  await changeStreams(students);

  // отдельный клиент с коротким таймаутом, чтобы secondary без вторичных не висел 30 секунд
  const rpClient = new MongoClient(uri, { serverSelectionTimeoutMS: 1500 });
  await rpClient.connect();
  await readPreference(rpClient);
  await rpClient.close();

  await client.close();
}

main().catch((err) => {
  console.error('Ошибка:', err.message);
  process.exit(1);
});
