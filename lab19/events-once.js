const EventEmitter = require('events');

const GROUP = '401';

function compareOnOnce() {
  const emitter = new EventEmitter();
  let onCount = 0;
  let onceCount = 0;

  emitter.on('tick', (n) => {
    onCount++;
    console.log(`[tick #${n}] on-слушатель`);
  });

  emitter.once('tick', (n) => {
    onceCount++;
    console.log(`[tick #${n}] once-слушатель`);
  });

  console.log('=== Сравнение on и once ===');
  for (let i = 1; i <= 3; i++) {
    emitter.emit('tick', i);
  }

  console.log(`\non-слушатель вызван: ${onCount} раза`);
  console.log(`once-слушатель вызван: ${onceCount} раз`);
}

function manageListeners() {
  const emitter = new EventEmitter();
  const first = () => console.log('первый');
  const second = () => console.log('второй');
  const third = () => console.log('третий');

  emitter.on('data', first);
  emitter.addListener('data', second);
  emitter.on('data', third);

  console.log('\n=== Управление подписками ===');
  console.log(`Слушателей до удаления: ${emitter.listenerCount('data')}`);
  console.log('listeners("data"):', emitter.listeners('data').map((fn) => fn.name));

  emitter.removeListener('data', second);
  console.log(`Слушателей после удаления одного: ${emitter.listenerCount('data')}`);
  console.log('listeners("data"):', emitter.listeners('data').map((fn) => fn.name));

  emitter.removeAllListeners('data');
  console.log(`Слушателей после removeAllListeners: ${emitter.listenerCount('data')}`);
}

function callOrder() {
  const emitter = new EventEmitter();

  emitter.on('start', () => console.log(`1. Первый слушатель (группа ${GROUP})`));
  emitter.on('start', () => console.log('2. Второй слушатель'));
  emitter.on('start', () => console.log('3. Третий слушатель'));

  console.log('\n=== Порядок вызова ===');
  emitter.emit('start');
}

compareOnOnce();
manageListeners();
callOrder();
