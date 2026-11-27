jest.mock('../../src/models/user');
jest.mock('../../src/services/mailService');

const bcrypt = require('bcryptjs');
const User = require('../../src/models/user');
const mailService = require('../../src/services/mailService');
const { notifier } = require('../../src/services/notifier');
const userService = require('../../src/services/userService');

describe('userService', () => {
  let events;

  beforeEach(() => {
    jest.resetAllMocks();
    events = [];
    notifier.removeAllListeners('event');
    notifier.on('event', (e) => events.push(e.event));
  });

  test('buildFilter собирает фильтры по группе, курсу, возрасту и поиску', () => {
    const filter = userService.buildFilter({ group_name: '401', course: 2, age_min: 18, age_max: 25, search: 'Иван' });
    expect(filter).toEqual({
      group_name: '401',
      course: 2,
      age: { $gte: 18, $lte: 25 },
      $text: { $search: 'Иван' }
    });
    expect(userService.buildFilter({ age_max: 20 })).toEqual({ age: { $lte: 20 } });
  });

  test('buildSort понимает минус как сортировку по убыванию', () => {
    expect(userService.buildSort('-age')).toEqual({ age: -1, _id: 1 });
    expect(userService.buildSort('name')).toEqual({ name: 1, _id: 1 });
    expect(userService.buildSort()).toEqual({ created_at: 1, _id: 1 });
  });

  test('listUsers считает метаданные пагинации', async () => {
    User.findAll.mockResolvedValue([{ name: 'Иван' }]);
    User.count.mockResolvedValue(23);

    const result = await userService.listUsers({ page: 2, limit: 5, sort: '-age', group_name: '401' });

    expect(User.findAll).toHaveBeenCalledWith({
      filter: { group_name: '401' }, sort: { age: -1, _id: 1 }, skip: 5, limit: 5, withDeleted: false
    });
    expect(result.pagination).toEqual({ total: 23, page: 2, limit: 5, pages: 5 });
  });

  test('listUsers по умолчанию page=1, limit=10', async () => {
    User.findAll.mockResolvedValue([]);
    User.count.mockResolvedValue(0);
    const result = await userService.listUsers();
    expect(result.pagination).toEqual({ total: 0, page: 1, limit: 10, pages: 0 });
  });

  test('getUser бросает 404, если пользователя нет', async () => {
    User.findById.mockResolvedValue(null);
    await expect(userService.getUser('x')).rejects.toMatchObject({ status: 404, message: 'User not found' });
  });

  test('createUser отклоняет занятый email с кодом 409', async () => {
    User.findByEmail.mockResolvedValue({ _id: '1', email: 'ivan@example.com' });
    await expect(userService.createUser({ email: 'ivan@example.com' })).rejects.toMatchObject({ status: 409 });
    expect(User.create).not.toHaveBeenCalled();
  });

  test('createUser хэширует пароль, отправляет письмо и событие', async () => {
    User.findByEmail.mockResolvedValue(null);
    User.create.mockImplementation(async (doc) => ({ _id: 'new', ...doc }));

    const user = await userService.createUser({ name: 'Иван', email: 'ivan@example.com', group_name: '401', password: 'secret123' });

    const saved = User.create.mock.calls[0][0];
    expect(saved.password).not.toBe('secret123');
    expect(await bcrypt.compare('secret123', saved.password)).toBe(true);
    expect(mailService.sendWelcome).toHaveBeenCalledWith(user);
    expect(events).toEqual(['user.created']);
  });

  test('createUser без отправки письма', async () => {
    User.findByEmail.mockResolvedValue(null);
    User.create.mockImplementation(async (doc) => ({ _id: 'new', ...doc }));
    await userService.createUser({ email: 'a@example.com' }, { sendMail: false });
    expect(mailService.sendWelcome).not.toHaveBeenCalled();
  });

  test('updateUser проверяет уникальность нового email', async () => {
    User.findById.mockResolvedValue({ _id: '1' });
    User.findByEmail.mockResolvedValue({ _id: '2' });
    await expect(userService.updateUser('1', { email: 'busy@example.com' })).rejects.toMatchObject({ status: 409 });
  });

  test('updateUser хэширует новый пароль и публикует событие без пароля', async () => {
    User.findById.mockResolvedValue({ _id: '1' });
    User.findByEmail.mockResolvedValue({ _id: '1' });
    User.update.mockResolvedValue({ _id: '1', name: 'Иван' });

    await userService.updateUser('1', { email: 'same@example.com', password: 'newpass1' });

    expect(User.update.mock.calls[0][1].password).toMatch(/^\$2[aby]\$10\$/);
    expect(events).toEqual(['user.updated']);
  });

  test('deleteUser делает мягкое удаление или возвращает 404', async () => {
    User.softDelete.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await userService.deleteUser('1');
    expect(events).toEqual(['user.deleted']);
    await expect(userService.deleteUser('1')).rejects.toMatchObject({ status: 404 });
  });

  test('restoreUser возвращает 404 для неудаленного пользователя', async () => {
    User.restore.mockResolvedValue(null);
    await expect(userService.restoreUser('1')).rejects.toMatchObject({ status: 404 });
  });

  test('getStats превращает результат агрегации в объекты', async () => {
    User.stats.mockResolvedValue({
      total: [{ count: 3, averageAge: 20.333 }],
      byGroup: [{ _id: '401', count: 2 }, { _id: '402', count: 1 }],
      byCourse: [{ _id: 1, count: 3 }],
      byRole: [{ _id: 'user', count: 3 }]
    });
    expect(await userService.getStats()).toEqual({
      total: 3, averageAge: 20.3, byGroup: { 401: 2, 402: 1 }, byCourse: { 1: 3 }, byRole: { user: 3 }
    });
  });

  test('getStats для пустой коллекции', async () => {
    User.stats.mockResolvedValue({ total: [], byGroup: [], byCourse: [], byRole: [] });
    expect((await userService.getStats()).total).toBe(0);
  });

  test('searchUsers округляет оценку релевантности', async () => {
    User.search.mockResolvedValue({ found: 1, data: [{ name: 'Иван', score: 1.23456 }] });
    expect(await userService.searchUsers('Иван')).toEqual({ found: 1, data: [{ name: 'Иван', score: 1.23 }] });
  });

  test('importUsers пропускает существующие и повторяющиеся email', async () => {
    const find = jest.fn().mockReturnValue({ toArray: async () => [{ email: 'old@example.com' }] });
    User.collection.mockReturnValue({ find });
    User.insertMany.mockImplementation(async (docs) => docs.length);

    const result = await userService.importUsers([
      { email: 'old@example.com' }, { email: 'new@example.com' }, { email: 'new@example.com' }
    ]);
    expect(result).toEqual({ inserted: 1, skipped: 2 });
  });

  test('exportUsers отдает csv и json', async () => {
    const rows = [{ _id: '1', name: 'Иван, младший', email: 'i@example.com', group_name: '401' }];
    User.cursor.mockImplementation(() => rows);

    const csv = await userService.exportUsers({});
    expect(csv.split('\n')[0]).toBe('_id,name,email,group_name,age,course,role,created_at');
    expect(csv).toContain('"Иван, младший"');
    expect(await userService.exportUsers({ format: 'json' })).toEqual(rows);
  });
});
