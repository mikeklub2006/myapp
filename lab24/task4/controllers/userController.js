const userService = require('../services/userService');

async function list(ctx) {
  ctx.body = await userService.listUsers(ctx.state.query);
}

async function search(ctx) {
  const { q, limit } = ctx.state.query;
  ctx.body = await userService.searchUsers(q, limit);
}

async function stats(ctx) {
  ctx.body = await userService.getStats();
}

async function exportCsv(ctx) {
  const csv = await userService.exportCsv(ctx.state.query);
  ctx.set('Content-Type', 'text/csv; charset=utf-8');
  ctx.set('Content-Disposition', 'attachment; filename="users.csv"');
  // bom нужен, чтобы excel правильно открыл кириллицу
  ctx.body = '\ufeff' + csv;
}

async function getOne(ctx) {
  ctx.body = { data: await userService.getUser(ctx.params.id) };
}

async function create(ctx) {
  const user = await userService.createUser(ctx.request.body);
  ctx.status = 201;
  ctx.body = { data: user };
}

async function update(ctx) {
  ctx.body = { data: await userService.updateUser(ctx.params.id, ctx.request.body) };
}

async function remove(ctx) {
  await userService.deleteUser(ctx.params.id);
  ctx.body = { data: { deleted: true, _id: ctx.params.id } };
}

module.exports = { list, search, stats, exportCsv, getOne, create, update, remove };
