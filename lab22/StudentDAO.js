class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const GROUP_FORMAT = /^\d{3}$/;

const SORTS = {
  name_asc: 'name ASC',
  name_desc: 'name DESC',
  grade_asc: 'grade ASC',
  grade_desc: 'grade DESC',
  created_at: 'created_at ASC, id ASC',
  created_at_desc: 'created_at DESC, id DESC'
};

class StudentDAO {
  constructor(pool) {
    this.pool = pool;
  }

  validate(data, partial = false) {
    const has = (key) => data[key] !== undefined;

    if (!partial || has('name')) {
      if (typeof data.name !== 'string' || !data.name.trim()) throw new ValidationError('name обязательное поле');
      const len = data.name.trim().length;
      if (len < 2) throw new ValidationError('name слишком короткое (мин. 2 символа)');
      if (len > 100) throw new ValidationError('name слишком длинное (макс. 100 символов)');
    }
    if (!partial || has('group_name')) {
      if (!data.group_name) throw new ValidationError('group_name обязательное поле');
      if (!GROUP_FORMAT.test(data.group_name)) throw new ValidationError('group_name не соответствует формату NNN (например 401)');
    }
    if (!partial || has('course')) {
      if (!Number.isInteger(data.course) || data.course < 1 || data.course > 4) {
        throw new ValidationError('course должен быть целым числом от 1 до 4');
      }
    }
    if (has('grade') && data.grade !== null) {
      if (typeof data.grade !== 'number' || data.grade < 0 || data.grade > 5) {
        throw new ValidationError('grade должен быть от 0 до 5 или NULL');
      }
    }
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        group_name VARCHAR(20) NOT NULL,
        course INT NOT NULL,
        grade DECIMAL(3,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async clear() {
    await this.pool.query('TRUNCATE TABLE students');
  }

  async create(data) {
    this.validate(data);
    const grade = data.grade === undefined ? null : data.grade;
    const [result] = await this.pool.execute(
      'INSERT INTO students (name, group_name, course, grade) VALUES (?, ?, ?, ?)',
      [data.name.trim(), data.group_name, data.course, grade]
    );
    return this.findById(result.insertId);
  }

  async findById(id) {
    const [rows] = await this.pool.execute('SELECT * FROM students WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async findAll(options = {}) {
    const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 10;
    const offset = Number.isInteger(options.offset) && options.offset >= 0 ? options.offset : 0;
    const order = SORTS[options.sort] || 'id ASC';

    const where = [];
    const params = [];
    if (options.group_name) {
      where.push('group_name = ?');
      params.push(options.group_name);
    }
    if (options.course !== undefined) {
      where.push('course = ?');
      params.push(options.course);
    }
    if (options.grade_min !== undefined) {
      where.push('grade >= ?');
      params.push(options.grade_min);
    }
    if (options.grade_max !== undefined) {
      where.push('grade <= ?');
      params.push(options.grade_max);
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [[{ total }]] = await this.pool.query(`SELECT COUNT(*) AS total FROM students ${whereSql}`, params);
    const [rows] = await this.pool.query(
      `SELECT * FROM students ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      data: rows,
      total,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      pages: Math.ceil(total / limit)
    };
  }

  async update(id, data) {
    this.validate(data, true);
    const fields = ['name', 'group_name', 'course', 'grade'].filter((f) => data[f] !== undefined);
    if (fields.length === 0) throw new ValidationError('нет полей для обновления');

    const sql = `UPDATE students SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`;
    const values = fields.map((f) => (f === 'name' ? data.name.trim() : data[f]));
    const [result] = await this.pool.execute(sql, [...values, id]);
    if (result.affectedRows === 0) return null;
    return this.findById(id);
  }

  async delete(id) {
    const [result] = await this.pool.execute('DELETE FROM students WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  async search(query) {
    if (typeof query !== 'string' || !query.trim()) return [];
    // экранируем спецсимволы LIKE
    const pattern = '%' + query.trim().replace(/[\\%_]/g, (c) => '\\' + c) + '%';
    const [rows] = await this.pool.execute('SELECT * FROM students WHERE name LIKE ? ORDER BY id', [pattern]);
    return rows;
  }

  async getStats() {
    const [[main]] = await this.pool.query(
      'SELECT COUNT(*) AS total, AVG(grade) AS avg, MIN(grade) AS min, MAX(grade) AS max FROM students'
    );
    const [groups] = await this.pool.query(
      'SELECT group_name, COUNT(*) AS cnt FROM students GROUP BY group_name ORDER BY group_name'
    );
    const [courses] = await this.pool.query(
      'SELECT course, COUNT(*) AS cnt FROM students GROUP BY course ORDER BY course'
    );

    const byGroup = {};
    groups.forEach((g) => { byGroup[g.group_name] = g.cnt; });
    const byCourse = {};
    courses.forEach((c) => { byCourse[c.course] = c.cnt; });

    return {
      total: main.total,
      averageGrade: main.avg === null ? null : Math.round(Number(main.avg) * 100) / 100,
      minGrade: main.min === null ? null : Number(main.min),
      maxGrade: main.max === null ? null : Number(main.max),
      byGroup,
      byCourse
    };
  }
}

module.exports = { StudentDAO, ValidationError };
