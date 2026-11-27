const Student = require('../models/student');
const { ValidationError } = require('../models/validation');
const { httpError } = require('./errors');

const MAX_BATCH = 100;

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new ValidationError('id должен быть положительным целым числом');
  return id;
}

function parsePaging(query) {
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ValidationError('limit должен быть от 1 до 100');
  if (!Number.isInteger(offset) || offset < 0) throw new ValidationError('offset должен быть >= 0');
  return { limit, offset };
}

async function list(db, query) {
  const { limit, offset } = parsePaging(query);
  const group = query.group || null;
  const { rows, total } = await Student.findAll(db, { limit, offset, group });
  return {
    data: rows,
    pagination: { total, limit, offset, pages: Math.ceil(total / limit) }
  };
}

async function get(db, idValue) {
  const id = parseId(idValue);
  const student = await Student.findById(db, id);
  if (!student) throw httpError(404, `Студент id=${id} не найден`);
  return student;
}

async function create(db, data) {
  Student.validate(data);
  const id = await Student.create(db, data);
  return Student.findById(db, id);
}

async function update(db, idValue, data) {
  const id = parseId(idValue);
  Student.validate(data, true);
  const affected = await Student.update(db, id, data);
  if (!affected) throw httpError(404, `Студент id=${id} не найден`);
  return Student.findById(db, id);
}

async function remove(db, idValue) {
  const id = parseId(idValue);
  const affected = await Student.remove(db, id);
  if (!affected) throw httpError(404, `Студент id=${id} не найден`);
  return { deleted: id };
}

async function createBatch(db, items) {
  if (!Array.isArray(items) || items.length === 0) throw new ValidationError('Ожидается непустой массив студентов');
  if (items.length > MAX_BATCH) throw new ValidationError(`Не больше ${MAX_BATCH} студентов за раз`);
  items.forEach((item, i) => {
    try {
      Student.validate(item);
    } catch (err) {
      err.message = `Элемент ${i}: ${err.message}`;
      throw err;
    }
  });

  const connection = await db.getConnection();
  const ids = [];
  try {
    await connection.beginTransaction();
    for (const item of items) {
      ids.push(await Student.create(connection, item));
    }
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    err.transaction = 'rolled back';
    throw err;
  } finally {
    connection.release();
  }

  return { created: ids.length, ids, transaction: 'committed' };
}

async function stats(db) {
  const { main, groups, courses } = await Student.stats(db);
  const byGroup = {};
  groups.forEach((g) => { byGroup[g.group_name] = g.cnt; });
  const byCourse = {};
  courses.forEach((c) => { byCourse[c.course] = c.cnt; });
  return {
    total: main.total,
    averageGrade: main.avg === null ? null : Math.round(Number(main.avg) * 100) / 100,
    minGrade: main.min,
    maxGrade: main.max,
    byGroup,
    byCourse
  };
}

module.exports = { list, get, create, update, remove, createBatch, stats, parseId };
