const { ObjectId } = require('mongodb');
const User = require('../models/user');

function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

function parseId(id) {
  // некорректный id считаем просто несуществующим пользователем
  if (!ObjectId.isValid(id) || String(new ObjectId(id)) !== id) {
    throw httpError(404, 'User not found');
  }
  return new ObjectId(id);
}

async function list(ctx) {
  const users = await ctx.db.collection(User.COLLECTION).find({}).sort({ created_at: 1 }).toArray();
  ctx.body = { data: users };
}

async function getOne(ctx) {
  const user = await ctx.db.collection(User.COLLECTION).findOne({ _id: parseId(ctx.params.id) });
  if (!user) throw httpError(404, 'User not found');
  ctx.body = { data: user };
}

async function create(ctx) {
  const body = ctx.request.body || {};
  const errors = User.validate(body);
  if (errors.length) throw httpError(400, 'Validation failed', errors);

  const doc = { ...User.toDocument(body), created_at: new Date() };
  const result = await ctx.db.collection(User.COLLECTION).insertOne(doc);
  ctx.status = 201;
  ctx.body = { data: { _id: result.insertedId, ...doc } };
}

async function update(ctx) {
  const id = parseId(ctx.params.id);
  const body = ctx.request.body || {};
  const errors = User.validate(body, true);
  if (errors.length) throw httpError(400, 'Validation failed', errors);

  const changes = User.toDocument(body);
  if (!Object.keys(changes).length) throw httpError(400, 'Validation failed', [{ field: 'body', message: 'нет полей для обновления' }]);

  const user = await ctx.db.collection(User.COLLECTION).findOneAndUpdate(
    { _id: id },
    { $set: { ...changes, updated_at: new Date() } },
    { returnDocument: 'after' }
  );
  if (!user) throw httpError(404, 'User not found');
  ctx.body = { data: user };
}

async function remove(ctx) {
  const result = await ctx.db.collection(User.COLLECTION).deleteOne({ _id: parseId(ctx.params.id) });
  if (!result.deletedCount) throw httpError(404, 'User not found');
  ctx.body = { data: { deleted: true, _id: ctx.params.id } };
}

module.exports = { list, getOne, create, update, remove };
