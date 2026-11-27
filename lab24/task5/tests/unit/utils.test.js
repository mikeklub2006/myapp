const { toCsv, parseCsv } = require('../../src/utils/csv');
const { findBadKey } = require('../../src/middleware/sanitize');
const rateLimit = require('../../src/middleware/rateLimit');
const { check } = require('../../src/middleware/validate');
const schemas = require('../../src/validators/schemas');

describe('csv', () => {
  test('toCsv экранирует запятые и кавычки', () => {
    const csv = toCsv([{ a: 'x, y', b: 'он сказал "да"', c: new Date('2024-01-01T00:00:00Z') }], ['a', 'b', 'c', 'd']);
    expect(csv).toBe('a,b,c,d\n"x, y","он сказал ""да""",2024-01-01T00:00:00.000Z,\n');
  });

  test('parseCsv читает файл с bom и кавычками', () => {
    const rows = parseCsv('\ufeffname,email\r\n"Олег, младший",oleg@example.com\r\n"А ""Б""",\n');
    expect(rows).toEqual([{ name: 'Олег, младший', email: 'oleg@example.com' }, { name: 'А "Б"' }]);
    expect(parseCsv('')).toEqual([]);
  });
});

describe('защита от nosql-инъекций', () => {
  test('находит операторы mongodb во вложенных объектах и массивах', () => {
    expect(findBadKey({ email: { $ne: null } })).toBe('$ne');
    expect(findBadKey([{ ok: 1 }, { nested: { 'a.b': 1 } }])).toBe('a.b');
    expect(findBadKey({ name: 'Иван', tags: ['a'] })).toBeNull();
  });
});

describe('валидация Joi', () => {
  test('ошибки переводятся на русский и содержат имя поля', () => {
    expect(() => check(schemas.createUser, { name: 'П', email: 'invalid' })).toThrow('Validation failed');
    try {
      check(schemas.createUser, { name: 'П', email: 'invalid', group_name: 'ББМО-01-23' });
    } catch (err) {
      expect(err.status).toBe(400);
      expect(err.details).toEqual([
        { field: 'name', message: 'минимум 2 символа' },
        { field: 'email', message: 'неверный формат' },
        { field: 'group_name', message: 'неверный формат (ожидается XXX, например 401)' }
      ]);
    }
  });

  test('query: значения по умолчанию и белый список сортировки', () => {
    expect(check(schemas.listQuery, {})).toEqual({ page: 1, limit: 10, sort: 'created_at' });
    expect(() => check(schemas.listQuery, { sort: 'password' })).toThrow();
    expect(() => check(schemas.listQuery, { limit: '101' })).toThrow();
  });
});

describe('rate limit', () => {
  test('после лимита возвращает 429', async () => {
    const limiter = rateLimit({ max: 2, windowMs: 1000 });
    const make = () => {
      const headers = {};
      return { ip: '1.1.1.1', set: (k, v) => { headers[k] = v; }, headers };
    };
    const next = jest.fn();

    for (let i = 0; i < 2; i++) await limiter(make(), next);
    const ctx = make();
    await limiter(ctx, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(ctx.status).toBe(429);
    expect(ctx.headers['Retry-After']).toBeDefined();
  });
});
