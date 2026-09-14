const http = require('http');
const EventEmitter = require('events');
const logger = require('./logger');

class AppServer extends EventEmitter {
  constructor() {
    super();
    this.server = null;
  }

  start(port) {
    this.server = http.createServer((req, res) => {
      this.emit('request:received', { url: req.url, method: req.method });

      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });

      if (req.method === 'GET' && req.url.startsWith('/order/')) {
        const orderId = req.url.split('/')[2];
        orderHandler.processOrder(orderId);
        res.end(`Hello from Event-Driven Server! Заказ #${orderId} принят в обработку`);
        return;
      }

      res.end('Hello from Event-Driven Server!');
    });

    this.server.listen(port, () => this.emit('server:started', port));
  }

  stop() {
    if (!this.server) return;
    this.server.close(() => this.emit('server:stopped'));
    this.server.closeAllConnections();
  }
}

class OrderHandler extends EventEmitter {
  processOrder(orderId) {
    this.emit('order:start', orderId);

    setTimeout(() => {
      this.emit('order:processing', orderId, 'Идёт обработка...');

      setTimeout(() => {
        const sum = Math.floor(Math.random() * 901) + 100;
        this.emit('order:complete', orderId, sum);
      }, 2000);
    }, 2000);
  }
}

class UserTracker extends EventEmitter {
  trackAction(userId, action, metadata) {
    this.emit('user:action', {
      userId: userId,
      action: action,
      timestamp: new Date().toISOString(),
      metadata: metadata,
      id: Math.random().toString(36).substr(2, 9)
    });
  }
}

// ряд Нилаканты, 7 знаков после запятой
function calcPI() {
  let pi = 3;
  let sign = 1;

  for (let i = 2; i <= 100000; i += 2) {
    pi += sign * 4 / (i * (i + 1) * (i + 2));
    sign = -sign;
  }

  return (Math.trunc(pi * 1e7) / 1e7).toFixed(7);
}

const app = new AppServer();
const orderHandler = new OrderHandler();
const tracker = new UserTracker();

app.on('server:started', (port) => console.log(`Сервер запущен на порту ${port}`));
app.on('request:received', (data) => console.log(`Получен запрос: ${data.method} ${data.url}`));
app.on('server:stopped', () => console.log('Сервер остановлен'));

logger.setupLogger(app);

orderHandler.on('order:start', (id) => console.log(`[order:start] Заказ #${id} начат`));
orderHandler.on('order:processing', (id, text) => console.log(`[order:processing] Заказ #${id}: ${text}`));
orderHandler.on('order:complete', (id, sum) => {
  console.log(`Заказ #${id} завершён на сумму ${sum} руб. PI = ${calcPI()}`);
});

tracker.on('user:action', (e) => {
  console.log(`Пользователь ${e.userId} совершил действие "${e.action}"`);
  console.log(`   Время: ${e.timestamp}`);
  console.log(`   ID события: ${e.id}`);
  console.log(`   Доп. данные: ${JSON.stringify(e.metadata)}`);
});

app.start(3000);

tracker.trackAction(1, 'login', { ip: '192.168.0.10', browser: 'Chrome' });
tracker.trackAction(2, 'purchase', { item: 'Клавиатура', price: 4500 });
tracker.trackAction(3, 'logout', { session: '18m', device: 'mobile' });

setTimeout(() => app.stop(), 10000);