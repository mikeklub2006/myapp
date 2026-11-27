const mysql = require('mysql2/promise');
const config = require('./index');
const logger = require('../services/logger');
const metrics = require('../services/metrics');

function shortSql(sql) {
  const text = sql.replace(/\s+/g, ' ').trim();
  return text.length > 120 ? text.slice(0, 117) + '...' : text;
}

async function timed(runner, sql, params) {
  const start = process.hrtime.bigint();
  try {
    const result = await runner.query(sql, params);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    metrics.recordQuery(ms, false);
    logger.sql(`${shortSql(sql)} (${ms.toFixed(1)}ms)`);
    return result;
  } catch (err) {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    metrics.recordQuery(ms, true);
    logger.error(`${shortSql(sql)} -> ${err.code}: ${err.message}`);
    throw err;
  }
}

// обертка над соединением из пула, чтобы транзакции тоже логировались
function wrapConnection(conn) {
  return {
    raw: conn,
    released: false,
    query: (sql, params) => timed(conn, sql, params),
    async beginTransaction() {
      await conn.beginTransaction();
      logger.sql('BEGIN TRANSACTION');
    },
    async commit() {
      await conn.commit();
      logger.sql('COMMIT');
    },
    async rollback() {
      await conn.rollback();
      logger.sql('ROLLBACK');
    },
    release() {
      if (this.released) return;
      this.released = true;
      conn.release();
    }
  };
}

function createDatabase() {
  const pool = mysql.createPool(config.db);
  logger.info(`Пул MySQL создан (лимит: ${config.db.connectionLimit})`);

  return {
    pool,
    query: (sql, params) => timed(pool, sql, params),
    async getConnection() {
      return wrapConnection(await pool.getConnection());
    },
    end: () => pool.end()
  };
}

module.exports = { createDatabase };
