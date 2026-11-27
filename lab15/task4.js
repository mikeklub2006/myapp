const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');

const PORT = process.env.PORT || 3000;
const app = new Koa();
const router = new Router({ prefix: '/students' });

let students = [
  { id: 1, name: 'Клубович Михаил', group: '401', course: 4 },
  { id: 2, name: 'Иванов Иван', group: '401', course: 4 },
  { id: 3, name: 'Смирнова Анна', group: '402', course: 4 },
  { id: 4, name: 'Петров Петр', group: '301', course: 3 },
  { id: 5, name: 'Кузнецова Мария', group: '201', course: 2 },
  { id: 6, name: 'Соколов Алексей', group: 'ББМО-01-23', course: 2 }
];
let nextId = 7;

// "401" -> 4 курс, "ББМО-01-23" -> курс по году поступления
function courseFromGroup(group) {
  if (/^\d{3}$/.test(group)) return Number(group[0]);

  const match = group.match(/-(\d{2})$/);
  if (match) {
    const year = 2000 + Number(match[1]);
    const now = new Date();
    let course = now.getFullYear() - year;
    if (now.getMonth() >= 8) course += 1;
    return course >= 1 && course <= 6 ? course : null;
  }
  return null;
}

function checkFields(data, partial) {
  const errors = [];

  if (data.name !== undefined || !partial) {
    if (typeof data.name !== 'string' || data.name.trim().length < 2) {
      errors.push('name: строка не короче 2 символов');
    }
  }
  if (data.group !== undefined || !partial) {
    if (typeof data.group !== 'string' || !data.group.trim()) {
      errors.push('group: обязательная непустая строка');
    }
  }
  if (data.course !== undefined) {
    if (!Number.isInteger(data.course) || data.course < 1 || data.course > 6) {
      errors.push('course: целое число от 1 до 6');
    }
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
  const { group } = ctx.query;
  ctx.body = group ? students.filter((s) => s.group === group) : students;
});

router.get('/:id', (ctx) => {
  ctx.body = getStudent(ctx);
});

router.post('/', (ctx) => {
  const data = ctx.request.body || {};
  const errors = checkFields(data, false);
  if (errors.length) ctx.throw(400, errors.join('; '));

  const group = data.group.trim();
  let course = data.course;
  if (course === undefined) {
    course = courseFromGroup(group);
    if (!course) ctx.throw(400, 'course: не указан и не вычисляется по номеру группы');
  }

  const student = { id: nextId++, name: data.name.trim(), group, course };
  students.push(student);
  ctx.status = 201;
  ctx.body = student;
});

router.put('/:id', (ctx) => {
  const student = getStudent(ctx);
  const data = ctx.request.body || {};

  if (data.name === undefined && data.group === undefined && data.course === undefined) {
    ctx.throw(400, 'Нужно передать хотя бы одно поле: name, group или course');
  }
  const errors = checkFields(data, true);
  if (errors.length) ctx.throw(400, errors.join('; '));

  if (data.name !== undefined) student.name = data.name.trim();
  if (data.group !== undefined) {
    student.group = data.group.trim();
    if (data.course === undefined) student.course = courseFromGroup(student.group) || student.course;
  }
  if (data.course !== undefined) student.course = data.course;

  ctx.body = student;
});

router.delete('/:id', (ctx) => {
  const student = getStudent(ctx);
  students = students.filter((s) => s.id !== student.id);
  ctx.body = { message: 'Студент удален', deleted: student };
});

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    let message = err.message;
    if (ctx.status === 500) message = 'Внутренняя ошибка сервера';
    ctx.body = { error: message, status: ctx.status };
  }
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
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log(`Студентов в списке: ${students.length}`);
});
