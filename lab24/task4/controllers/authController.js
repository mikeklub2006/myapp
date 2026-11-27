const authService = require('../services/authService');
const userService = require('../services/userService');

async function register(ctx) {
  ctx.status = 201;
  ctx.body = await authService.register(ctx.request.body);
}

async function login(ctx) {
  const { email, password } = ctx.request.body;
  ctx.body = await authService.login(email, password, ctx.ip);
}

async function refresh(ctx) {
  ctx.body = await authService.refresh(ctx.request.body.refreshToken);
}

async function logout(ctx) {
  await authService.logout(ctx.request.body.refreshToken, ctx.user);
  ctx.body = { data: { loggedOut: true } };
}

async function me(ctx) {
  ctx.body = { data: await userService.getUser(ctx.user.userId) };
}

async function adminUsers(ctx) {
  ctx.body = await userService.listUsers(ctx.state.query);
}

async function setRole(ctx) {
  ctx.body = { data: await userService.updateUser(ctx.params.id, { role: ctx.request.body.role }) };
}

module.exports = { register, login, refresh, logout, me, adminUsers, setRole };
