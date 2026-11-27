const authService = require('../services/authService');
const userService = require('../services/userService');

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Регистрация
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: Иван }
 *               email: { type: string, example: ivan@example.com }
 *               password: { type: string, example: secret123 }
 *               group_name: { type: string, example: '401' }
 *     responses:
 *       201: { description: Пользователь и пара токенов }
 *       409: { description: Email уже существует }
 */
async function register(ctx) {
  ctx.status = 201;
  ctx.body = await authService.register(ctx.request.body, ctx.ip);
}

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Вход, возвращает access (15 мин) и refresh (7 дней) токены
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, example: admin@example.com }
 *               password: { type: string, example: admin123 }
 *     responses:
 *       200: { description: Токены }
 *       401: { description: Invalid credentials }
 */
async function login(ctx) {
  ctx.body = await authService.login(ctx.request.body.email, ctx.request.body.password, ctx.ip);
}

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Обновление пары токенов по refresh-токену
 *     requestBody:
 *       content: { application/json: { schema: { type: object, properties: { refreshToken: { type: string } } } } }
 *     responses:
 *       200: { description: Новые токены }
 *       401: { description: Недействительный refresh-токен }
 */
async function refresh(ctx) {
  ctx.body = await authService.refresh(ctx.request.body.refreshToken);
}

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Выход (refresh-токен отзывается)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, properties: { refreshToken: { type: string } } } } }
 *     responses:
 *       200: { description: Выход выполнен }
 */
async function logout(ctx) {
  await authService.logout(ctx.request.body.refreshToken, ctx.user);
  ctx.body = { data: { loggedOut: true } };
}

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Текущий пользователь
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Профиль }
 */
async function me(ctx) {
  ctx.body = { data: await userService.getUser(ctx.user.userId) };
}

module.exports = { register, login, refresh, logout, me };
