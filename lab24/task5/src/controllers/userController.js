const fs = require('fs');
const path = require('path');
const userService = require('../services/userService');
const { check } = require('../middleware/validate');
const schemas = require('../validators/schemas');
const { parseCsv } = require('../utils/csv');
const HttpError = require('../utils/httpError');
const config = require('../config');

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Список пользователей с пагинацией, фильтрами и сортировкой
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *       - { in: query, name: sort, schema: { type: string, example: -age } }
 *       - { in: query, name: group_name, schema: { type: string, example: '401' } }
 *       - { in: query, name: course, schema: { type: integer } }
 *       - { in: query, name: age_min, schema: { type: integer } }
 *       - { in: query, name: age_max, schema: { type: integer } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses:
 *       200: { description: Список, content: { application/json: { schema: { $ref: '#/components/schemas/UserList' } } } }
 *       400: { description: Ошибка валидации query-параметров }
 */
async function list(ctx) {
  ctx.body = await userService.listUsers(ctx.state.query);
}

/**
 * @openapi
 * /api/users/search:
 *   get:
 *     tags: [Users]
 *     summary: Полнотекстовый поиск по имени и email
 *     parameters:
 *       - { in: query, name: q, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Найденные пользователи с оценкой релевантности }
 */
async function search(ctx) {
  ctx.body = await userService.searchUsers(ctx.state.query.q, ctx.state.query.limit);
}

/**
 * @openapi
 * /api/users/stats:
 *   get:
 *     tags: [Users]
 *     summary: Статистика (агрегация MongoDB)
 *     responses:
 *       200: { description: Общее количество, средний возраст, распределение по группам и курсам }
 */
async function stats(ctx) {
  ctx.body = await userService.getStats();
}

/**
 * @openapi
 * /api/users/export:
 *   get:
 *     tags: [Users]
 *     summary: Экспорт пользователей в CSV или JSON
 *     parameters:
 *       - { in: query, name: format, schema: { type: string, enum: [csv, json], default: csv } }
 *     responses:
 *       200: { description: Файл с пользователями }
 */
async function exportUsers(ctx) {
  const format = ctx.state.query.format || 'csv';
  const result = await userService.exportUsers({ ...ctx.state.query, format });
  ctx.set('Content-Disposition', `attachment; filename="users.${format}"`);
  if (format === 'json') {
    ctx.body = result;
  } else {
    ctx.type = 'text/csv; charset=utf-8';
    ctx.body = '\ufeff' + result;
  }
}

/**
 * @openapi
 * /api/users/import:
 *   post:
 *     tags: [Admin]
 *     summary: Импорт пользователей (JSON-массив или файл .csv/.json)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json: { schema: { type: array, items: { $ref: '#/components/schemas/UserInput' } } }
 *         multipart/form-data: { schema: { type: object, properties: { file: { type: string, format: binary } } } }
 *     responses:
 *       200: { description: Количество добавленных и пропущенных записей }
 */
async function importUsers(ctx) {
  let items = ctx.request.body;
  const file = ctx.request.file || ctx.file;
  if (file) {
    const text = file.buffer.toString('utf8');
    items = file.originalname.toLowerCase().endsWith('.csv') ? parseCsv(text) : JSON.parse(text);
  }
  if (!Array.isArray(items)) throw new HttpError(400, 'Validation failed', [{ field: 'body', message: 'ожидается массив' }]);

  const value = check(schemas.importUsers, items.map(({ _id, created_at, role, ...rest }) => rest));
  ctx.body = await userService.importUsers(value);
}

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Пользователь по id
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Пользователь }
 *       404: { description: Не найден }
 */
async function getOne(ctx) {
  ctx.body = { data: await userService.getUser(ctx.params.id) };
}

/**
 * @openapi
 * /api/users:
 *   post:
 *     tags: [Users]
 *     summary: Создание пользователя
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/UserInput' } } }
 *     responses:
 *       201: { description: Создан }
 *       400: { description: Ошибка валидации }
 *       401: { description: Нет токена }
 *       409: { description: Email уже существует }
 */
async function create(ctx) {
  ctx.status = 201;
  ctx.body = { data: await userService.createUser(ctx.request.body) };
}

/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Обновление (владелец, admin или moderator)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content: { application/json: { schema: { $ref: '#/components/schemas/UserInput' } } }
 *     responses:
 *       200: { description: Обновлен }
 *       403: { description: Недостаточно прав }
 */
async function update(ctx) {
  ctx.body = { data: await userService.updateUser(ctx.params.id, ctx.request.body) };
}

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Мягкое удаление (владелец или admin), ставится deleted_at
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Удален }
 *       404: { description: Не найден }
 */
async function remove(ctx) {
  await userService.deleteUser(ctx.params.id);
  ctx.body = { data: { deleted: true, _id: ctx.params.id } };
}

/**
 * @openapi
 * /api/users/{id}/avatar:
 *   post:
 *     tags: [Users]
 *     summary: Загрузка аватара (png, jpeg, gif, webp до 2 МБ)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         multipart/form-data: { schema: { type: object, properties: { avatar: { type: string, format: binary } } } }
 *     responses:
 *       200: { description: Аватар сохранен }
 *   get:
 *     tags: [Users]
 *     summary: Получить аватар
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Изображение }
 *       404: { description: Нет аватара }
 */
async function uploadAvatar(ctx) {
  const file = ctx.request.file || ctx.file;
  if (!file) throw new HttpError(400, 'Validation failed', [{ field: 'avatar', message: 'файл не передан' }]);
  try {
    ctx.body = { data: await userService.setAvatar(ctx.params.id, file.filename) };
  } catch (err) {
    fs.unlink(file.path, () => {});
    throw err;
  }
}

async function getAvatar(ctx) {
  const user = await userService.getUser(ctx.params.id);
  if (!user.avatar) throw new HttpError(404, 'Avatar not found');
  const file = path.join(config.uploadDir, path.basename(user.avatar));
  if (!fs.existsSync(file)) throw new HttpError(404, 'Avatar not found');
  ctx.type = path.extname(file);
  ctx.body = fs.createReadStream(file);
}

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Все пользователи, включая удаленные (только admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: query, name: withDeleted, schema: { type: boolean } }]
 *     responses:
 *       200: { description: Список }
 *       403: { description: Нужна роль admin }
 */
async function adminList(ctx) {
  ctx.body = await userService.listUsers(ctx.state.query);
}

/**
 * @openapi
 * /api/admin/users/{id}/restore:
 *   post:
 *     tags: [Admin]
 *     summary: Восстановить удаленного пользователя
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Восстановлен }
 */
async function restore(ctx) {
  ctx.body = { data: await userService.restoreUser(ctx.params.id) };
}

/**
 * @openapi
 * /api/admin/users/{id}/role:
 *   patch:
 *     tags: [Admin]
 *     summary: Сменить роль пользователя
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, properties: { role: { type: string, enum: [user, moderator, admin] } } } } }
 *     responses:
 *       200: { description: Роль изменена }
 */
async function setRole(ctx) {
  ctx.body = { data: await userService.updateUser(ctx.params.id, { role: ctx.request.body.role }) };
}

module.exports = {
  list, search, stats, exportUsers, importUsers, getOne, create, update, remove,
  uploadAvatar, getAvatar, adminList, restore, setRole
};
