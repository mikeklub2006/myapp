const { ValidationError } = require('./validation');

const GROUP_FORMAT = /^\d{3}$/;
const FIELDS = ['name', 'group_name', 'course', 'grade'];
const COLUMNS = 'id, name, group_name, course, grade, created_at';

function validate(data, partial = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ValidationError('Ожидается JSON-объект студента');
  }
  const has = (key) => data[key] !== undefined;

  if (!partial || has('name')) {
    if (typeof data.name !== 'string') throw new ValidationError('name обязательное поле');
    const len = data.name.trim().length;
    if (len < 2 || len > 100) throw new ValidationError('name должно быть от 2 до 100 символов');
  }
  if (!partial || has('group_name')) {
    if (typeof data.group_name !== 'string' || !GROUP_FORMAT.test(data.group_name)) {
      throw new ValidationError('group_name должен быть в формате NNN (например 401)');
    }
  }
  if (!partial || has('course')) {
    if (!Number.isInteger(data.course) || data.course < 1 || data.course > 4) {
      throw new ValidationError('course должен быть целым числом от 1 до 4');
    }
  }
  if (has('grade') && data.grade !== null) {
    if (typeof data.grade !== 'number' || data.grade < 0 || data.grade > 5) {
      throw new ValidationError('grade должен быть числом от 0 до 5 или null');
    }
  }
  if (partial && !FIELDS.some(has)) {
    throw new ValidationError('Нет полей для обновления');
  }
}

function toRow(data) {
  return [data.name.trim(), data.group_name, data.course, data.grade === undefined ? null : data.grade];
}

async function findAll(db, { limit, offset, group }) {
  const where = group ? 'WHERE group_name = ?' : '';
  const params = group ? [group] : [];
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM students ${where}`, params);
  const [rows] = await db.query(
    `SELECT ${COLUMNS} FROM students ${where} ORDER BY id LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return { rows, total };
}

async function findById(db, id) {
  const [rows] = await db.query(`SELECT ${COLUMNS} FROM students WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function create(db, data) {
  const [result] = await db.query(
    'INSERT INTO students (name, group_name, course, grade) VALUES (?, ?, ?, ?)',
    toRow(data)
  );
  return result.insertId;
}

async function update(db, id, data) {
  const fields = FIELDS.filter((f) => data[f] !== undefined);
  const values = fields.map((f) => (f === 'name' ? data.name.trim() : data[f]));
  const [result] = await db.query(
    `UPDATE students SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`,
    [...values, id]
  );
  return result.affectedRows;
}

async function remove(db, id) {
  const [result] = await db.query('DELETE FROM students WHERE id = ?', [id]);
  return result.affectedRows;
}

async function stats(db) {
  const [[main]] = await db.query(
    'SELECT COUNT(*) AS total, AVG(grade) AS avg, MIN(grade) AS min, MAX(grade) AS max FROM students'
  );
  const [groups] = await db.query('SELECT group_name, COUNT(*) AS cnt FROM students GROUP BY group_name ORDER BY group_name');
  const [courses] = await db.query('SELECT course, COUNT(*) AS cnt FROM students GROUP BY course ORDER BY course');
  return { main, groups, courses };
}

module.exports = { validate, toRow, findAll, findById, create, update, remove, stats };
