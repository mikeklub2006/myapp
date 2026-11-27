const Group = require('../models/group');
const { parseId } = require('./studentService');
const { httpError } = require('./errors');

async function list(db) {
  return { data: await Group.findAll(db) };
}

async function create(db, data) {
  Group.validate(data);
  const id = await Group.create(db, data);
  return Group.findById(db, id);
}

async function students(db, idValue) {
  const id = parseId(idValue);
  const group = await Group.findById(db, id);
  if (!group) throw httpError(404, `Группа id=${id} не найдена`);
  const rows = await Group.students(db, group.name);
  return { group, count: rows.length, data: rows };
}

module.exports = { list, create, students };
