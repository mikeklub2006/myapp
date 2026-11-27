const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

const DIR = __dirname;

function readMigration(file) {
  const text = fs.readFileSync(path.join(DIR, file), 'utf8');
  const [, up = '', down = ''] = text.split(/^--\s*(?:up|down)\s*$/m);
  const split = (sql) => sql.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean);
  return { up: split(up), down: split(down) };
}

function migrationFiles() {
  return fs.readdirSync(DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
}

async function ensureTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);
}

async function appliedList(conn) {
  const [rows] = await conn.query('SELECT name FROM migrations ORDER BY id');
  return rows.map((r) => r.name);
}

async function migrate(log = console.log) {
  const conn = await mysql.createConnection(config.db);
  try {
    await ensureTable(conn);
    const applied = await appliedList(conn);
    const pending = migrationFiles().filter((f) => !applied.includes(f));

    for (const file of pending) {
      for (const sql of readMigration(file).up) {
        await conn.query(sql);
      }
      await conn.query('INSERT INTO migrations (name) VALUES (?)', [file]);
      log(`[MIGRATE] Применена ${file}`);
    }
    return { total: applied.length + pending.length, applied: pending.length };
  } finally {
    await conn.end();
  }
}

async function rollback(log = console.log) {
  const conn = await mysql.createConnection(config.db);
  try {
    await ensureTable(conn);
    const applied = await appliedList(conn);
    const last = applied[applied.length - 1];
    if (!last) {
      log('[MIGRATE] Откатывать нечего');
      return null;
    }
    for (const sql of readMigration(last).down) {
      await conn.query(sql);
    }
    await conn.query('DELETE FROM migrations WHERE name = ?', [last]);
    log(`[MIGRATE] Откачена ${last}`);
    return last;
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  const action = process.argv[2] === 'rollback' ? rollback : migrate;
  action()
    .then((res) => {
      if (res && res.total !== undefined) console.log(`[MIGRATE] Всего миграций: ${res.total}, новых: ${res.applied}`);
    })
    .catch((err) => {
      console.error(`[MIGRATE] Ошибка: ${err.code || ''} ${err.message}`);
      process.exitCode = 1;
    });
}

module.exports = { migrate, rollback };
