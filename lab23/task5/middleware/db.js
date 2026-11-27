function dbMiddleware(db, service) {
  return async (ctx, next) => {
    ctx.db = db;
    ctx.students = service;
    await next();
  };
}

module.exports = dbMiddleware;
