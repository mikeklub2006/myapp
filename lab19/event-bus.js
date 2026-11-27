const EventEmitter = require('events');
const http = require('http');
const os = require('os');

const GROUP = '401';
const PORT = process.env.PORT || 3000;

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.handlers = {};
    this.anyHandlers = [];
    this.metrics = {};
    this.total = 0;
    this.order = 0;
  }

  on(event, listener, priority = 0) {
    return this.addHandler(event, listener, priority, false);
  }

  once(event, listener, priority = 0) {
    return this.addHandler(event, listener, priority, true);
  }

  addHandler(event, listener, priority, once) {
    if (!this.handlers[event]) this.handlers[event] = [];
    const list = this.handlers[event];
    list.push({ listener, priority, once, order: this.order++ });
    list.sort((a, b) => b.priority - a.priority || a.order - b.order);
    return this;
  }

  off(event, listener) {
    const list = this.handlers[event];
    if (!list) return this;
    const index = list.findIndex((h) => h.listener === listener);
    if (index !== -1) list.splice(index, 1);
    if (list.length === 0) delete this.handlers[event];
    return this;
  }

  onAny(listener) {
    this.anyHandlers.push(listener);
    return this;
  }

  listenerCount(event) {
    return this.handlers[event] ? this.handlers[event].length : 0;
  }

  emit(event, ...args) {
    if (event === 'error') {
      this.handleError(args[0], args[1]);
      return true;
    }

    if (!this.metrics[event]) this.metrics[event] = { count: 0, errors: 0, lastCall: null };
    const stat = this.metrics[event];
    stat.count++;
    stat.lastCall = new Date().toISOString();
    this.total++;

    for (const fn of this.anyHandlers) {
      fn(event, args);
    }

    const list = this.handlers[event];
    if (!list) return false;

    for (const h of [...list]) {
      if (h.once) this.off(event, h.listener);
      try {
        h.listener(...args);
      } catch (err) {
        stat.errors++;
        this.handleError(err, event);
      }
    }
    return true;
  }

  handleError(err, event) {
    const list = this.handlers.error;
    if (!list) {
      console.error(`[ERROR] [${GROUP}] ${err.message}`);
      return;
    }
    for (const h of [...list]) {
      h.listener(err, event);
    }
  }

  getMetrics() {
    const events = {};
    const lastCall = {};
    let errors = 0;
    for (const [name, stat] of Object.entries(this.metrics)) {
      events[name] = stat.count;
      lastCall[name] = stat.lastCall;
      errors += stat.errors;
    }

    const listeners = {};
    for (const [name, list] of Object.entries(this.handlers)) {
      if (name !== 'error') listeners[name] = list.length;
    }

    return { group: GROUP, events, total: this.total, errors, lastCall, listeners };
  }
}

function plural(n, forms) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

const bus = new EventBus();

console.log(`=== EventBus (группа ${GROUP}) ===`);

console.log('\n--- Приоритеты ---');
const demo = new EventBus();
demo.on('priority', () => console.log('[priority 0]  Низкий приоритет'));
demo.on('priority', () => console.log('[priority 10] Высокий приоритет'), 10);
demo.on('priority', () => console.log('[priority 5]  Средний приоритет'), 5);
demo.on('priority', () => console.log('[priority 5]  Средний приоритет (добавлен вторым)'), 5);
demo.emit('priority');

console.log('\n--- Wildcard ---');
const anyLogger = (event, args) => {
  if (event === 'request' || event === 'system') return;
  console.log(`[onAny] Событие "${event}" с аргументами: ${JSON.stringify(args)}`);
};
bus.onAny(anyLogger);
bus.on('greet', (name) => console.log(`[greet] Привет, ${name}!`));
bus.emit('greet', 'Михаил');
bus.emit('info', GROUP);

console.log('\n--- Once-кэш ---');
let onceCalls = 0;
bus.on('tick', (n) => console.log(`[tick] Вызов ${n}`));
bus.once('tick', () => onceCalls++);
for (let i = 1; i <= 3; i++) bus.emit('tick', i);
console.log(`once-слушатель вызван: ${onceCalls} раз`);
console.log(`слушателей tick осталось: ${bus.listenerCount('tick')}`);

console.log('\n--- Обработка ошибок ---');
bus.on('error', (err, event) => {
  console.log(`[ERROR] [${GROUP}] Ошибка в слушателе "${event}": ${err.message}`);
}, 100);
bus.once('test', () => {
  throw new Error('деление на ноль');
});
bus.once('test2', (data) => JSON.parse(data));
bus.emit('test');
bus.emit('test');
bus.emit('test2', '{bad json');
bus.emit('greet', 'Иван');

console.log('\n--- Метрики ---');
for (const [name, stat] of Object.entries(bus.metrics)) {
  let line = `${(name + ':').padEnd(7)} ${stat.count} ${plural(stat.count, ['вызов', 'вызова', 'вызовов'])}`;
  if (stat.errors) line += ` (${stat.errors} ${plural(stat.errors, ['ошибка', 'ошибки', 'ошибок'])})`;
  console.log(line);
}
console.log(`Всего событий: ${bus.total}`);

bus.on('system', (info) => {
  console.log(`[system] [${GROUP}] свободно памяти: ${info.freeMem} МБ из ${info.totalMem} МБ, load: ${info.load}`);
});

function systemInfo() {
  return {
    host: os.hostname(),
    platform: os.platform(),
    cpus: os.cpus().length,
    freeMem: Math.round(os.freemem() / 1024 / 1024),
    totalMem: Math.round(os.totalmem() / 1024 / 1024),
    load: os.loadavg().map((n) => n.toFixed(2)).join(' '),
    uptime: Math.round(os.uptime())
  };
}

bus.on('request', (req) => {
  console.log(`[request] ${req.method} ${req.url}`);
});

const server = http.createServer((req, res) => {
  bus.emit('request', { method: req.method, url: req.url });

  if (req.method === 'GET' && req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(bus.getMetrics(), null, 2));
    return;
  }

  if (req.method === 'GET' && req.url === '/system') {
    const info = systemInfo();
    bus.emit('system', info);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ group: GROUP, ...info }, null, 2));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Not Found', url: req.url }));
});

server.listen(PORT, () => {
  console.log(`\nHTTP-сервер запущен: http://localhost:${PORT}/metrics (также /system)`);
  bus.emit('system', systemInfo());
});

const timer = setInterval(() => bus.emit('system', systemInfo()), 30000);

process.on('SIGINT', () => {
  clearInterval(timer);
  server.close(() => process.exit(0));
});
