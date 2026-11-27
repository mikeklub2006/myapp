const { snapshot } = require('../middleware/metrics');

function send(ctx, { value, hit }) {
  ctx.set('X-Cache', hit ? 'HIT' : 'MISS');
  ctx.body = value;
}

async function list(ctx) {
  send(ctx, await ctx.students.list(ctx.url, ctx.query));
}

async function getOne(ctx) {
  const result = await ctx.students.get(ctx.url, ctx.params.id);
  send(ctx, { value: { data: result.value }, hit: result.hit });
}

async function create(ctx) {
  ctx.status = 201;
  ctx.body = { data: await ctx.students.create(ctx.request.body) };
}

async function update(ctx) {
  ctx.body = { data: await ctx.students.update(ctx.params.id, ctx.request.body) };
}

async function remove(ctx) {
  ctx.body = await ctx.students.remove(ctx.params.id);
}

async function stats(ctx) {
  send(ctx, await ctx.students.stats(ctx.url));
}

async function search(ctx) {
  send(ctx, await ctx.students.search(ctx.url, ctx.query.q));
}

async function batch(ctx) {
  ctx.status = 201;
  ctx.body = await ctx.students.batch(ctx.request.body);
}

async function metrics(ctx) {
  ctx.body = snapshot(ctx.students.cache.stats());
}

module.exports = { list, getOne, create, update, remove, stats, search, batch, metrics };
