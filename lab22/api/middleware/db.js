function dbMiddleware(database) {
  return async (ctx, next) => {
    const taken = [];

    ctx.db = {
      query: (sql, params) => database.query(sql, params),
      async getConnection() {
        const conn = await database.getConnection();
        taken.push(conn);
        return conn;
      }
    };

    try {
      await next();
    } finally {
      // если контроллер забыл вернуть соединение - возвращаем сами
      for (const conn of taken) {
        if (!conn.released) conn.release();
      }
    }
  };
}

module.exports = dbMiddleware;
