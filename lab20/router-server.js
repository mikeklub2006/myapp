const http = require('http');

const PORT = process.env.PORT || 3000;
const GROUP = '401';

let students = [
  { id: 1, name: 'Иван', group: GROUP },
  { id: 2, name: 'Мария', group: GROUP },
  { id: 3, name: 'Михаил', group: GROUP },
  { id: 4, name: 'Анна', group: '402' },
  { id: 5, name: 'Олег', group: '403' }
];
let nextId = 6;

const posts = {
  1: [{ id: 1, title: 'Первый пост' }, { id: 2, title: 'Второй пост' }],
  2: [{ id: 1, title: 'Привет от Марии' }]
};

function timestamp() {
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

function sendText(res, status, text, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(text + '\n');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Слишком большое тело запроса'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Некорректный JSON'));
      }
    });
    req.on('error', reject);
  });
}

// /users/:id -> ^/users/([^/]+)$
function compile(pattern) {
  const keys = [];
  const source = pattern.replace(/:(\w+)/g, (_, key) => {
    keys.push(key);
    return '([^/]+)';
  });
  return { regex: new RegExp(`^${source}/?$`), keys };
}

const routes = [];

function addRoute(method, pattern, handler) {
  routes.push({ method, pattern, handler, ...compile(pattern) });
}

function findStudent(id) {
  return students.find((s) => s.id === Number(id));
}

addRoute('GET', '/', (req, res) => {
  sendJson(res, 200, {
    group: GROUP,
    routes: routes.map((r) => `${r.method} ${r.pattern}`)
  });
});

addRoute('GET', '/search', (req, res, { query }) => {
  const q = query.get('q') || '';
  const limit = Number(query.get('limit')) || 10;
  const page = Number(query.get('page')) || 1;
  const found = students.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
  sendJson(res, 200, { q, limit, page, total: found.length, results: found.slice((page - 1) * limit, page * limit) });
});

addRoute('GET', '/users/:id', (req, res, { params }) => {
  const student = findStudent(params.id);
  if (!student) return sendJson(res, 404, { error: `Пользователь ${params.id} не найден` });
  sendJson(res, 200, { params, user: student });
});

addRoute('GET', '/users/:userId/posts/:postId', (req, res, { params }) => {
  const list = posts[params.userId] || [];
  const post = list.find((p) => p.id === Number(params.postId));
  if (!post) return sendJson(res, 404, { error: 'Пост не найден', params });
  sendJson(res, 200, { params, post });
});

addRoute('GET', '/api/students', (req, res, { query }) => {
  const group = query.get('group');
  sendJson(res, 200, group ? students.filter((s) => s.group === group) : students);
});

addRoute('GET', '/api/students/:id', (req, res, { params }) => {
  const student = findStudent(params.id);
  if (!student) return sendJson(res, 404, { error: `Студент ${params.id} не найден` });
  sendJson(res, 200, student);
});

addRoute('POST', '/api/students', async (req, res) => {
  const data = await readJson(req);
  if (!data.name || typeof data.name !== 'string') {
    return sendJson(res, 400, { error: 'Поле name обязательно' });
  }
  const student = { id: nextId++, name: data.name, group: data.group || GROUP };
  students.push(student);
  sendJson(res, 201, student);
});

addRoute('PUT', '/api/students/:id', async (req, res, { params }) => {
  const student = findStudent(params.id);
  if (!student) return sendJson(res, 404, { error: `Студент ${params.id} не найден` });
  const data = await readJson(req);
  if (data.name !== undefined) student.name = String(data.name);
  if (data.group !== undefined) student.group = String(data.group);
  sendJson(res, 200, student);
});

addRoute('DELETE', '/api/students/:id', (req, res, { params }) => {
  const student = findStudent(params.id);
  if (!student) return sendJson(res, 404, { error: `Студент ${params.id} не найден` });
  students = students.filter((s) => s !== student);
  sendJson(res, 200, { deleted: true, id: student.id });
});

function match(method, pathname) {
  const allowed = [];
  for (const route of routes) {
    const m = route.regex.exec(pathname);
    if (!m) continue;
    if (route.method !== method) {
      allowed.push(route.method);
      continue;
    }
    const params = {};
    route.keys.forEach((key, i) => {
      params[key] = decodeURIComponent(m[i + 1]);
    });
    return { route, params };
  }
  return { allowed };
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (err) {
    return value;
  }
}

const server = http.createServer(async (req, res) => {
  res.on('finish', () => {
    console.log(`[${timestamp()}] [${GROUP}] ${req.method} ${safeDecode(req.url)} ${res.statusCode}`);
  });

  let url;
  let found;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    found = match(req.method, url.pathname);
  } catch (err) {
    return sendText(res, 400, '400 Bad Request');
  }
  const pathname = safeDecode(url.pathname);

  if (!found.route) {
    if (found.allowed.length) {
      return sendText(res, 405, '405 Method Not Allowed', { Allow: [...new Set(found.allowed)].join(', ') });
    }
    return sendText(res, 404, `404 Not Found: ${pathname}`);
  }

  try {
    await found.route.handler(req, res, { params: found.params, query: url.searchParams });
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`[${GROUP}] Сервер запущен на порту ${PORT}`);
});
