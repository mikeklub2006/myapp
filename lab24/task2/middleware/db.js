function dbMiddleware(db) {
  return async (ctx, next) => {
    ctx.db = db;
    await next();
  };
}

module.exports = dbMiddleware;
