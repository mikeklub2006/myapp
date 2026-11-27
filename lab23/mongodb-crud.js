require('dotenv').config();
const { MongoClient, BSON } = require('mongodb');
const { GROUP, createRandom, makeStudent } = require('./generator');

const uri = process.env.MONGO_URI || 'mongodb://student:password@localhost:27017/bbmo_401';

function show(doc) {
  const parts = Object.entries(doc).map(([key, value]) => {
    if (key === '_id') return `_id: ${String(value).slice(-6)}`;
    if (value instanceof Date) return `${key}: ${value.toISOString().slice(0, 10)}`;
    if (typeof value === 'string') return `${key}: "${value}"`;
    if (Array.isArray(value)) return `${key}: [${value.join(', ')}]`;
    return `${key}: ${value}`;
  });
  console.log(`  { ${parts.join(', ')} }`);
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const students = db.collection('students');

  // начинаем с чистой коллекции, чтобы вывод был одинаковым
  await students.drop().catch(() => {});
  await students.createIndex({ group_name: 1 });

  const random = createRandom(401);

  console.log(`=== Коллекция students (группа ${GROUP}) ===`);

  console.log('\n--- INSERT ---');
  const one = await students.insertOne({
    name: 'Иван Иванов',
    group_name: GROUP,
    course: 2,
    grade: 4.5,
    created_at: new Date()
  });
  console.log(`✔ Вставлен: insertedId=ObjectId("${one.insertedId}")`);

  const many = await students.insertMany([
    { name: 'Мария Петрова', group_name: GROUP, course: 2, grade: 3.8, created_at: new Date() },
    { name: 'Петр Сидоров', group_name: GROUP, course: 2, grade: 4.2, created_at: new Date() },
    { name: 'Анна Смирнова', group_name: '402', course: 3, grade: 2.6, created_at: new Date() }
  ]);
  const ids = Object.entries(many.insertedIds).map(([i, id]) => `${i}: "${String(id).slice(-6)}"`);
  console.log(`✔ Вставлено ${many.insertedCount} документа: insertedIds={ ${ids.join(', ')} }`);

  const extra = [];
  for (let i = 0; i < 6; i++) {
    extra.push(makeStudent(random, i, i < 2 ? GROUP : null));
  }
  extra.forEach((s) => delete s.email);
  extra[3].grade = 2.4;
  extra[4].grade = 2.9;
  const rest = await students.insertMany(extra);
  console.log(`✔ Дополнительно вставлено: ${rest.insertedCount}`);

  console.log('\n--- SELECT ---');
  // find возвращает курсор, toArray грузит все в память - тут документов мало, можно
  const all = await students.find({}).toArray();
  console.log(`Все документы (${all.length}):`);
  all.forEach(show);

  const byGroup = await students.find({ group_name: GROUP }).toArray();
  console.log(`\nС фильтром по группе ${GROUP} (${byGroup.length}):`);
  byGroup.forEach((s) => show({ name: s.name, group: s.group_name, grade: s.grade }));

  const sorted = await students.find({}, { projection: { name: 1, grade: 1, _id: 0 } }).sort({ grade: -1, name: 1 }).toArray();
  console.log('\nС сортировкой по grade (по убыванию):');
  sorted.forEach(show);

  const pageSize = 3;
  for (let page = 1; page <= 2; page++) {
    const docs = await students.find({}, { projection: { name: 1, grade: 1, _id: 0 } })
      .sort({ grade: -1, name: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    console.log(`\nПагинация: страница ${page} (limit=${pageSize}, skip=${(page - 1) * pageSize}):`);
    docs.forEach(show);
  }

  const found = await students.findOne({ _id: one.insertedId });
  console.log(`\nfindOne({ _id: ObjectId("${one.insertedId}") }):`);
  show(found);

  const projected = await students.find({}, { projection: { name: 1, grade: 1, _id: 0 } }).toArray();
  console.log('\nС проекцией (только name, grade):');
  projected.forEach(show);

  const fullSize = all.reduce((sum, d) => sum + BSON.calculateObjectSize(d), 0);
  const projSize = projected.reduce((sum, d) => sum + BSON.calculateObjectSize(d), 0);
  console.log(`Размер выборки: полная ${fullSize} байт, с проекцией ${projSize} байт ` +
    `(меньше на ${Math.round((1 - projSize / fullSize) * 100)}%)`);

  console.log('\n--- UPDATE ---');
  let res = await students.updateOne({ _id: one.insertedId }, { $set: { grade: 4.8 }, $push: { tags: 'староста' } });
  console.log(`✔ updateOne ($set grade=4.8, $push tags): matchedCount=${res.matchedCount}, modifiedCount=${res.modifiedCount}`);

  res = await students.updateOne({ name: 'Мария Петрова' }, { $inc: { grade: 0.3 } });
  console.log(`✔ updateOne ($inc grade+0.3): matchedCount=${res.matchedCount}, modifiedCount=${res.modifiedCount}`);

  res = await students.updateOne({ _id: one.insertedId }, { $unset: { tags: '' } });
  console.log(`✔ updateOne ($unset tags): matchedCount=${res.matchedCount}, modifiedCount=${res.modifiedCount}`);

  res = await students.updateMany({ group_name: GROUP }, { $inc: { course: 1 } });
  console.log(`✔ updateMany (group=${GROUP}, $inc: course+1): matchedCount=${res.matchedCount}, modifiedCount=${res.modifiedCount}`);

  res = await students.updateOne({ name: 'Нет Такого' }, { $set: { grade: 5 } });
  console.log(`  updateOne несуществующего: matchedCount=${res.matchedCount}, modifiedCount=${res.modifiedCount}`);

  const ivan = await students.findOne({ _id: one.insertedId }, { projection: { _id: 0, created_at: 0 } });
  console.log('После обновления:');
  show(ivan);

  console.log('\n--- DELETE ---');
  res = await students.deleteOne({ name: 'Петр Сидоров' });
  console.log(`✔ deleteOne: deletedCount=${res.deletedCount}`);

  res = await students.deleteMany({ grade: { $lt: 3 } });
  console.log(`✔ deleteMany (grade < 3): deletedCount=${res.deletedCount}`);

  console.log(`\nОсталось документов: ${await students.countDocuments()}`);

  await client.close();
}

main().catch((err) => {
  console.error('Ошибка:', err.message);
  process.exit(1);
});
