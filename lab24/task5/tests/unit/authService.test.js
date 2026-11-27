jest.mock('../../src/models/user');
jest.mock('../../src/models/refreshToken');
jest.mock('../../src/services/userService');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../src/models/user');
const RefreshToken = require('../../src/models/refreshToken');
const userService = require('../../src/services/userService');
const authService = require('../../src/services/authService');

const user = { _id: 'u1', email: 'ivan@example.com', role: 'user', name: 'Иван' };

describe('authService', () => {
  beforeEach(() => jest.resetAllMocks());

  test('issueTokens выдает access на 15 минут с userId, email и role', async () => {
    const tokens = await authService.issueTokens(user);
    const payload = jwt.verify(tokens.accessToken, process.env.JWT_SECRET);

    expect(tokens.expiresIn).toBe(900);
    expect(payload).toMatchObject({ userId: 'u1', email: 'ivan@example.com', role: 'user' });
    expect(jwt.decode(tokens.accessToken, { complete: true }).header.alg).toBe('HS256');
    expect(RefreshToken.save).toHaveBeenCalledTimes(1);
  });

  test('refresh-токен живет 7 дней', async () => {
    const { refreshToken } = await authService.issueTokens(user);
    const { iat, exp } = jwt.decode(refreshToken);
    expect(exp - iat).toBe(7 * 24 * 3600);
  });

  test('login: неверный пароль дает 401 без деталей', async () => {
    User.findForLogin.mockResolvedValue({ ...user, password: await bcrypt.hash('secret123', 4) });
    await expect(authService.login('ivan@example.com', 'wrong')).rejects.toMatchObject({ status: 401, message: 'Invalid credentials' });
  });

  test('login: неизвестный email дает тот же ответ 401', async () => {
    User.findForLogin.mockResolvedValue(null);
    await expect(authService.login('nobody@example.com', 'x')).rejects.toMatchObject({ status: 401, message: 'Invalid credentials' });
  });

  test('login: правильный пароль возвращает токены', async () => {
    User.findForLogin.mockResolvedValue({ ...user, password: await bcrypt.hash('secret123', 4) });
    const result = await authService.login('ivan@example.com', 'secret123', '127.0.0.1');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  test('register создает пользователя с ролью user', async () => {
    userService.createUser.mockResolvedValue(user);
    const result = await authService.register({ name: 'Иван', email: 'ivan@example.com', password: 'secret123', role: 'admin' });
    expect(userService.createUser.mock.calls[0][0].role).toBe('user');
    expect(result.data).toEqual({ userId: 'u1', email: 'ivan@example.com', role: 'user' });
  });

  test('refresh с поддельным токеном - 401', async () => {
    await expect(authService.refresh('bad.token.here')).rejects.toMatchObject({ status: 401 });
  });

  test('refresh с уже использованным токеном - 401', async () => {
    const { refreshToken } = await authService.issueTokens(user);
    RefreshToken.remove.mockResolvedValue(false);
    await expect(authService.refresh(refreshToken)).rejects.toMatchObject({ status: 401 });
  });

  test('refresh для удаленного пользователя - 401', async () => {
    const { refreshToken } = await authService.issueTokens(user);
    RefreshToken.remove.mockResolvedValue(true);
    User.findById.mockResolvedValue(null);
    await expect(authService.refresh(refreshToken)).rejects.toMatchObject({ status: 401 });
  });

  test('refresh выдает новую пару', async () => {
    const { refreshToken } = await authService.issueTokens(user);
    RefreshToken.remove.mockResolvedValue(true);
    User.findById.mockResolvedValue(user);
    const result = await authService.refresh(refreshToken);
    expect(result.refreshToken).not.toBe(refreshToken);
  });

  test('logout отзывает refresh-токен владельца и не падает на мусоре', async () => {
    const { refreshToken } = await authService.issueTokens(user);
    await authService.logout(refreshToken, { userId: 'u1', email: user.email });
    expect(RefreshToken.remove).toHaveBeenCalledTimes(1);
    await expect(authService.logout('garbage', { userId: 'u1' })).resolves.toBeUndefined();
  });

  test('ensureAdmin создает администратора только один раз', async () => {
    User.findByEmail.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: 'a' });
    expect(await authService.ensureAdmin()).toBe(true);
    expect(userService.createUser.mock.calls[0][0].role).toBe('admin');
    expect(await authService.ensureAdmin()).toBe(false);
  });
});
