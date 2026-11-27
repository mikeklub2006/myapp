require('dotenv').config();
const { spawnSync } = require('child_process');
const v8 = require('v8');
const vm = require('vm');
const { MongoClient } = require('mongodb');
const { GROUPS, createRandom, makeStudent } = require('./generator');

const uri = process.env.MONGO_URI || 'mongodb://student:password@localhost:27017/bbmo_401';
const TOTAL = Number(process.env.TOTAL) || 1000000;
const BATCH = 10000;

// без ручного gc замеры памяти скачут, поэтому включаем его
v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc');

const CURATORS = { 401: 'Иванов И.И.', 402: 'Петрова А.С.', 403: 'Сидоров В.П.' };

function mb(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}

async function generate(collection) {
  const count = await collection.estimatedDocumentCount();
  if (count === TOTAL) {
    console.log(`Коллекция ${collection.collectionName} уже содержит ${TOTAL} документов`);
    return;
  }

  await collection.drop().catch(() => {});
  console.log(`Генерация ${TOTAL.toLocaleString('ru-RU')} документов...`);
  const start = Date.now();
  const random = createRandom(401);

  for (let i = 0; i < TOTAL; i += BATCH) {
    const docs = [];
    for (let j = i; j < Math.min(i + BATCH, TOTAL); j++) {
      docs.push(makeStudent(random, j));
    }
    await collection.insertMany(docs, { ordered: false });
    if ((i + BATCH) % 200000 === 0) console.log(`  вставлено ${(i + BATCH).toLocaleString('ru-RU')}`);
  }
  console.log(`✔ Сгенерировано за ${((Date.now() - start) / 1000).toFixed(1)} сек`);
}

async function cursors(collection) {
  console.log('\n=== Курсоры ===');

  const cursor = collection.find({}, { projection: { name: 1, grade: 1 } });
  console.log(`find() вернул: ${cursor.constructor.name} (данные еще не загружены)`);
  console.log('cursor.next() - по одному:');
  for (let i = 0; i < 3; i++) {
    const doc = await cursor.next();
    console.log(`  ${doc.name}, grade=${doc.grade}`);
  }
  await cursor.close();
  console.log(`cursor.close(): закрыт = ${cursor.killed}`);

  console.log('\nИтерация через for await (batchSize 1000):');
  gc();
  const baseHeap = process.memoryUsage().heapUsed;
  let peak = baseHeap;
  let processed = 0;
  let sum = 0;
  let excellent = 0;
  const start = Date.now();

  const stream = collection.find({}).batchSize(1000);
  for await (const doc of stream) {
    processed++;
    sum += doc.grade;
    if (doc.grade >= 4.5) excellent++;
    if (processed % 10000 === 0) {
      const heap = process.memoryUsage().heapUsed;
      if (heap > peak) peak = heap;
    }
  }

  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`  Получено ${processed} документов за ${seconds} сек`);
  console.log(`  Средний балл: ${(sum / processed).toFixed(2)}, отличников (>= 4.5): ${excellent}`);
  console.log(`Пик памяти (heap): ${mb(peak)} МБ`);

  // оцениваем, сколько памяти займет toArray, по выборке из 10000 документов
  gc();
  const before = process.memoryUsage().heapUsed;
  const sample = await collection.find({}).limit(10000).toArray();
  gc();
  const perDoc = (process.memoryUsage().heapUsed - before) / sample.length;
  const need = perDoc * processed;

  console.log('\nЧерез toArray() (дочерний процесс с --max-old-space-size=64):');
  const child = spawnSync(process.execPath, ['--max-old-space-size=64', __filename, '--toarray'], {
    encoding: 'utf8',
    env: process.env
  });
  const output = (child.stdout || '') + (child.stderr || '');
  if (/heap out of memory/i.test(output)) {
    console.log('✖ Ошибка: JavaScript heap out of memory');
  } else if (child.status !== 0) {
    console.log(`✖ Процесс завершился с кодом ${child.status}`);
  } else {
    console.log(`  ${output.trim()}`);
  }
  console.log(`  Требуется ~${mb(need)} МБ памяти (итерация обошлась в ~${mb(peak - baseHeap)} МБ)`);
}

async function aggregations(db, collection) {
  console.log('\n=== Агрегации ===');

  const groups = db.collection('groups');
  await groups.deleteMany({});
  await groups.insertMany(GROUPS.map((name) => ({ group_name: name, curator: CURATORS[name] })));

  const avg = await collection.aggregate([
    { $group: { _id: '$group_name', avg: { $avg: '$grade' } } },
    { $sort: { _id: 1 } }
  ]).toArray();
  console.log('Средний балл по группам:');
  avg.forEach((g) => console.log(`  ${g._id}: ${g.avg.toFixed(2)}`));

  const courses = await collection.aggregate([
    { $group: { _id: '$course', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]).toArray();
  console.log('\nКоличество по курсам:');
  courses.forEach((c) => console.log(`  ${c._id} курс: ${c.count}`));

  const top = await collection.aggregate([
    { $match: { group_name: '401' } },
    { $sort: { grade: -1, _id: 1 } },
    { $limit: 10 },
    { $project: { _id: 0, name: 1, grade: 1, course: 1 } }
  ]).toArray();
  console.log('\nТоп-10 студентов группы 401 по оценке:');
  top.forEach((s, i) => console.log(`  ${i + 1}. ${s.name} (${s.course} курс) - ${s.grade}`));

  const joined = await collection.aggregate([
    { $group: { _id: '$group_name', students: { $sum: 1 }, avg: { $avg: '$grade' } } },
    { $lookup: { from: 'groups', localField: '_id', foreignField: 'group_name', as: 'info' } },
    { $unwind: '$info' },
    { $project: { _id: 0, group_name: '$_id', students: 1, curator: '$info.curator', avg: { $round: ['$avg', 2] } } },
    { $sort: { group_name: 1 } }
  ]).toArray();
  console.log('\n$lookup (JOIN с groups):');
  joined.forEach((g) => {
    console.log(`  { group_name: "${g.group_name}", students: ${g.students}, curator: "${g.curator}", avg: ${g.avg} }`);
  });
}

async function indexes(collection) {
  console.log('\n=== Индексы ===');
  await collection.dropIndexes();

  const query = { group_name: '401', grade: { $gte: 4.9 } };

  const noIndex = await collection.find(query).explain('executionStats');
  const s1 = noIndex.executionStats;

  console.log(`✔ Создан индекс: ${await collection.createIndex({ group_name: 1 })}`);
  console.log(`✔ Создан индекс: ${await collection.createIndex({ group_name: 1, grade: -1 })}`);
  console.log(`✔ Создан уникальный индекс: ${await collection.createIndex({ email: 1 }, { unique: true })}`);

  try {
    await collection.insertOne({ name: 'Дубликат', email: 'student1@bbmo.local' });
  } catch (err) {
    console.log(`  вставка того же email: ✖ ${err.code === 11000 ? 'E11000 duplicate key' : err.message}`);
  }

  const withIndex = await collection.find(query).explain('executionStats');
  const s2 = withIndex.executionStats;
  const plan = withIndex.queryPlanner.winningPlan;
  const usedIndex = plan.inputStage ? plan.inputStage.indexName : '-';

  console.log(`\nЗапрос: find(${JSON.stringify(query)})`);
  console.log('explain() без индекса:');
  console.log(`  stage: ${noIndex.queryPlanner.winningPlan.stage}`);
  console.log(`  executionTimeMillis: ${s1.executionTimeMillis}`);
  console.log(`  totalDocsExamined: ${s1.totalDocsExamined}`);
  console.log(`  nReturned: ${s1.nReturned}`);

  console.log('explain() с индексом:');
  console.log(`  stage: IXSCAN (${usedIndex})`);
  console.log(`  executionTimeMillis: ${s2.executionTimeMillis}`);
  console.log(`  totalKeysExamined: ${s2.totalKeysExamined}`);
  console.log(`  totalDocsExamined: ${s2.totalDocsExamined}`);
  console.log(`  nReturned: ${s2.nReturned}`);
  const speedup = s1.executionTimeMillis / Math.max(s2.executionTimeMillis, 1);
  console.log(`  ✔ Ускорение в ${Math.round(speedup)} раз`);
}

async function textSearch(collection) {
  console.log('\n=== Текстовый поиск ===');
  const name = await collection.createIndex({ name: 'text' }, { default_language: 'russian' });
  console.log(`Создан текстовый индекс: ${name}`);

  const filter = { $text: { $search: 'Иван' } };
  const found = await collection.countDocuments(filter);
  const top = await collection.find(filter, { projection: { _id: 0, name: 1, score: { $meta: 'textScore' } } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(3)
    .toArray();

  console.log('find({ $text: { $search: "Иван" } }):');
  console.log(`  Найдено: ${found} документов`);
  top.forEach((doc, i) => console.log(`  Топ-${i + 1}: score=${doc.score.toFixed(2)}, name="${doc.name}"`));
}

async function toArrayChild() {
  const client = new MongoClient(uri);
  await client.connect();
  const docs = await client.db(process.env.DB_NAME).collection('students_big').find({}).toArray();
  console.log(`toArray() загрузил ${docs.length} документов`);
  await client.close();
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const collection = db.collection('students_big');

  await generate(collection);
  await cursors(collection);
  await aggregations(db, collection);
  await indexes(collection);
  await textSearch(collection);

  await client.close();
}

if (process.argv.includes('--toarray')) {
  toArrayChild().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
} else {
  main().catch((err) => {
    console.error('Ошибка:', err.message);
    process.exit(1);
  });
}
