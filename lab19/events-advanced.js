const EventEmitter = require('events');

const GROUP = '401';
const PREFIX = `[${GROUP}]`;

class PluginManager extends EventEmitter {
  constructor() {
    super();
    this.plugins = new Map();

    this.on('newListener', (event) => {
      if (event === 'removeListener') return;
      console.log(`[newListener] Добавлен слушатель "${event}"`);
    });

    this.on('removeListener', (event) => {
      console.log(`[removeListener] Удалён слушатель "${event}"`);
    });
  }

  register(plugin) {
    this.plugins.set(plugin.name, plugin);
    this.emit('plugin:registered', plugin.name);
    this.on(plugin.event, plugin.handler);
  }

  unregister(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return;
    this.removeListener(plugin.event, plugin.handler);
    this.plugins.delete(name);
    this.emit('plugin:removed', name);
  }
}

function pluginSystem() {
  console.log('=== Система плагинов ===');
  const manager = new PluginManager();

  manager.on('plugin:registered', (name) => console.log(`\n[PLUGIN] Зарегистрирован: ${name}`));
  manager.on('plugin:removed', (name) => console.log(`[PLUGIN] Удалён: ${name}`));

  manager.register({
    name: 'LoggerPlugin',
    event: 'log',
    handler: (msg) => console.log(`[LOG] ${msg}`)
  });
  manager.register({
    name: 'AlertPlugin',
    event: 'alert',
    handler: (msg) => console.log(`[ALERT] ${msg}`)
  });

  manager.emit('log', `логгер работает ${PREFIX}`);
  manager.emit('alert', `внимание ${PREFIX}`);

  console.log();
  manager.unregister('LoggerPlugin');
  console.log(`emit("log") после удаления плагина: ${manager.emit('log', 'test')}`);
}

function leakDemo() {
  console.log('\n=== Демонстрация утечки ===');
  const emitter = new EventEmitter();
  emitter.setMaxListeners(20);

  process.once('warning', (w) => console.log(`[warning] ${w.name}: слушателей ${w.count}, лимит 20`));

  for (let i = 0; i < 10; i++) {
    emitter.on('data', () => {});
  }
  console.log(`Слушателей до: ${emitter.listenerCount('data')}`);

  // каждый "запрос" подписывается и не отписывается
  const handlers = [];
  for (let i = 0; i < 1000; i++) {
    const handler = () => {};
    handlers.push(handler);
    emitter.on('data', handler);
  }
  console.log(`Слушателей после добавления 1000: ${emitter.listenerCount('data')}`);

  for (const handler of handlers) {
    emitter.removeListener('data', handler);
  }
  console.log(`Слушателей после removeListener для 1000: ${emitter.listenerCount('data')}`);

  emitter.removeAllListeners('data');
  console.log(`Слушателей после removeAllListeners: ${emitter.listenerCount('data')}`);
}

function asyncListeners() {
  console.log('\n=== Асинхронные слушатели ===');
  const emitter = new EventEmitter();
  const start = Date.now();

  emitter.on('job', async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log(`${PREFIX} async-слушатель завершён через ${Date.now() - start}ms`);
  });

  emitter.on('job', () => {
    setImmediate(() => console.log(`${PREFIX} отложенный слушатель (setImmediate) выполнен`));
  });

  emitter.emit('job');
  console.log(`${PREFIX} emit вызван (не ждёт async-слушатель)`);
}

pluginSystem();
leakDemo();
setImmediate(asyncListeners);
