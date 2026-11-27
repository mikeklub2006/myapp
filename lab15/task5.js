const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');

const PORT = process.env.PORT || 3000;
const GROUP = '401';
const STUDENTS_COUNT = 50;

const app = new Koa();
const router = new Router({ prefix: '/students' });

const maleNames = ['Александр', 'Алексей', 'Андрей', 'Антон', 'Дмитрий', 'Иван', 'Илья',
  'Кирилл', 'Максим', 'Михаил', 'Никита', 'Павел', 'Роман', 'Сергей', 'Егор'];
const femaleNames = ['Анна', 'Алена', 'Александра', 'Валерия', 'Дарья', 'Екатерина',
  'Елена', 'Ксения', 'Мария', 'Наталья', 'Ольга', 'Полина', 'Софья', 'Татьяна'];
const surnames = ['Иванов', 'Смирнов', 'Кузнецов', 'Попов', 'Васильев', 'Петров', 'Соколов',
  'Михайлов', 'Новиков', 'Федоров', 'Морозов', 'Волков', 'Алексеев', 'Лебедев', 'Семенов',
  'Егоров', 'Павлов', 'Козлов', 'Степанов', 'Николаев', 'Орлов', 'Андреев', 'Макаров'];

// генератор с фиксированным зерном, чтобы при каждом запуске были одни и те же данные
function createRandom(seed) {
  let state = seed >>> 0;
  return function () {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

function generateStudents(groupNumber, count) {
  const random = createRandom(Number(groupNumber));
  const groups = [];
  for (let course = 1; course <= 4; course++) {
    groups.push(`${course}01`, `${course}02`);
  }

  const result = [];
  for (let i = 1; i <= count; i++) {
    const isFemale = random() < 0.5;
    const firstName = isFemale ? pick(random, femaleNames) : pick(random, maleNames);
    const surname = pick(random, surnames) + (isFemale ? 'а' : '');
    // примерно треть студентов кладем в свою группу
    const group = random() < 0.3 ? groupNumber : pick(random, groups);

    result.push({
      id: i,
      name: `${surname} ${firstName}`,
      group,
      course: Number(group[0])
    });
  }
  return result;
}

let students = generateStudents(GROUP, STUDENTS_COUNT);
let nextId = students.length + 1;

const SORT_FIELDS = ['id', 'name', 'group', 'course'];

function parseNumber(value, name, def, min, max) {
  if (value === undefined || value === '') return def;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw Object.assign(new Error(`${name}: целое число от ${min} до ${max}`), { status: 400 });
  }
  return n;
}

function compare(a, b, field) {
  if (typeof a[field] === 'string') return a[field].localeCompare(b[field], 'ru');
  return a[field] - b[field];
}

function validateStudent(data, partial) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['тело запроса должно быть JSON-объектом'];
  }

  if (!partial || data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.trim().length < 2) {
      errors.push('name: строка не короче 2 символов');
    } else if (!/^[А-Яа-яЁёA-Za-z\s-]+$/.test(data.name.trim())) {
      errors.push('name: допустимы только буквы, пробел и дефис');
    }
  }
  if (!partial || data.group !== undefined) {
    if (typeof data.group !== 'string' || !/^[1-4]\d{2}$/.test(data.group)) {
      errors.push('group: номер группы из трех цифр, первая цифра 1-4 (например 401)');
    }
  }
  if (data.course !== undefined) {
    if (!Number.isInteger(data.course) || data.course < 1 || data.course > 4) {
      errors.push('course: целое число от 1 до 4');
    } else if (typeof data.group === 'string' && Number(data.group[0]) !== data.course) {
      errors.push('course: не совпадает с первой цифрой номера группы');
    }
  }
  if (partial && data.name === undefined && data.group === undefined && data.course === undefined) {
    errors.push('нужно передать хотя бы одно поле: name, group, course');
  }
  return errors;
}

function getStudent(ctx) {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id < 1) ctx.throw(400, 'id должен быть положительным целым числом');
  const student = students.find((s) => s.id === id);
  if (!student) ctx.throw(404, `Студент с id ${id} не найден`);
  return student;
}

router.get('/', (ctx) => {
  const { search, sort, group, course } = ctx.query;
  const limit = parseNumber(ctx.query.limit, 'limit', 10, 1, 100);
  const offset = parseNumber(ctx.query.offset, 'offset', 0, 0, Number.MAX_SAFE_INTEGER);

  let list = students.slice();

  if (search) {
    const text = search.toLowerCase();
    list = list.filter((s) => s.name.toLowerCase().includes(text));
  }
  if (group) list = list.filter((s) => s.group === group);
  if (course) list = list.filter((s) => s.course === Number(course));

  if (sort) {
    const desc = sort.startsWith('-');
    const field = desc ? sort.slice(1) : sort;
    if (!SORT_FIELDS.includes(field)) {
      ctx.throw(400, `sort: допустимые поля ${SORT_FIELDS.join(', ')} (с "-" для обратного порядка)`);
    }
    list.sort((a, b) => (desc ? -compare(a, b, field) : compare(a, b, field)));
  }

  ctx.body = {
    total: list.length,
    limit,
    offset,
    count: Math.min(limit, Math.max(list.length - offset, 0)),
    data: list.slice(offset, offset + limit)
  };
});

router.get('/:id', (ctx) => {
  ctx.body = getStudent(ctx);
});

router.post('/', (ctx) => {
  const data = ctx.request.body;
  const errors = validateStudent(data, false);
  if (errors.length) ctx.throw(400, errors.join('; '));

  const student = {
    id: nextId++,
    name: data.name.trim(),
    group: data.group,
    course: Number(data.group[0])
  };
  students.push(student);
  ctx.status = 201;
  ctx.body = student;
});

router.put('/:id', (ctx) => {
  const student = getStudent(ctx);
  const data = ctx.request.body;
  const errors = validateStudent(data, true);
  if (errors.length) ctx.throw(400, errors.join('; '));

  if (data.course !== undefined && data.group === undefined && Number(student.group[0]) !== data.course) {
    ctx.throw(400, 'course: не совпадает с первой цифрой номера группы, укажите новую группу');
  }

  if (data.name !== undefined) student.name = data.name.trim();
  if (data.group !== undefined) {
    student.group = data.group;
    student.course = Number(data.group[0]);
  }
  ctx.body = student;
});

router.delete('/:id', (ctx) => {
  const student = getStudent(ctx);
  students = students.filter((s) => s.id !== student.id);
  ctx.body = { message: `Студент с id ${student.id} удален`, deleted: student };
});

app.use(async (ctx, next) => {
  const start = Date.now();
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    let message = err.message;
    if (ctx.status === 500) {
      console.error(err);
      message = 'Внутренняя ошибка сервера';
    }
    ctx.body = { error: message, status: ctx.status };
  }
  console.log(`${ctx.method} ${ctx.url} ${ctx.status} - ${Date.now() - start}ms`);
});

app.use(bodyParser({
  enableTypes: ['json'],
  onerror: (err, ctx) => ctx.throw(400, 'Некорректный JSON в теле запроса')
}));
app.use(router.routes());
app.use(router.allowedMethods());

app.use((ctx) => {
  ctx.throw(404, 'Маршрут не найден');
});

app.listen(PORT, () => {
  const groups = new Set(students.map((s) => s.group));
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log(`Сгенерировано студентов: ${students.length} (зерно - номер группы ${GROUP})`);
  console.log(`Группы: ${[...groups].sort().join(', ')}`);
});
