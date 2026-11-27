const { ValidationError } = require('./validation');

const GROUP_FORMAT = /^\d{3}$/;

function validate(data) {
  if (!data || typeof data.name !== 'string' || !GROUP_FORMAT.test(data.name)) {
    throw new ValidationError('name группы должен быть в формате NNN (например 401)');
  }
}

async function findAll(db) {
  const [rows] = await db.query(`
    SELECT g.id, g.name, g.created_at, COUNT(s.id) AS students
    FROM student_groups g
    LEFT JOIN students s ON s.group_name = g.name
    GROUP BY g.id, g.name, g.created_at
    ORDER BY g.name
  `);
  return rows;
}

async function findById(db, id) {
  const [rows] = await db.query('SELECT id, name, created_at FROM student_groups WHERE id = ?', [id]);
  return rows[0] || null;
}

async function create(db, data) {
  const [result] = await db.query('INSERT INTO student_groups (name) VALUES (?)', [data.name]);
  return result.insertId;
}

async function students(db, groupName) {
  const [rows] = await db.query(
    'SELECT id, name, group_name, course, grade, created_at FROM students WHERE group_name = ? ORDER BY id',
    [groupName]
  );
  return rows;
}

module.exports = { validate, findAll, findById, create, students };
