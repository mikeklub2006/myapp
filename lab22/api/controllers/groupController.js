const service = require('../services/groupService');

async function list(ctx) {
  ctx.body = await service.list(ctx.db);
}

async function create(ctx) {
  ctx.status = 201;
  ctx.body = await service.create(ctx.db, ctx.request.body);
}

async function students(ctx) {
  ctx.body = await service.students(ctx.db, ctx.params.id);
}

module.exports = { list, create, students };
