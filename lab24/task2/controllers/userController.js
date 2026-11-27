const userService = require('../services/userService');

async function list(ctx) {
  ctx.body = { data: await userService.listUsers() };
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

module.exports = { list, getOne, create, update, remove };
