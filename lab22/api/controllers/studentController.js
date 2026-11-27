const service = require('../services/studentService');

async function list(ctx) {
  ctx.body = await service.list(ctx.db, ctx.query);
}

async function get(ctx) {
  ctx.body = await service.get(ctx.db, ctx.params.id);
}

async function create(ctx) {
  ctx.status = 201;
  ctx.body = await service.create(ctx.db, ctx.request.body);
}

async function update(ctx) {
  ctx.body = await service.update(ctx.db, ctx.params.id, ctx.request.body);
}

async function remove(ctx) {
  ctx.body = await service.remove(ctx.db, ctx.params.id);
}

async function batch(ctx) {
  ctx.status = 201;
  ctx.body = await service.createBatch(ctx.db, ctx.request.body);
}

async function stats(ctx) {
  ctx.body = await service.stats(ctx.db);
}

module.exports = { list, get, create, update, remove, batch, stats };
