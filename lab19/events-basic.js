const EventEmitter = require('events');

const GROUP = '401';
const emitter = new EventEmitter();

emitter.on('greet', (name) => {
  console.log(`[greet] Привет, ${name}!`);
});

emitter.on('info', (group) => {
  console.log(`[info] Группа: ${group}`);
});

emitter.on('bye', () => {
  console.log('[bye] До свидания!');
});

console.log('=== Демонстрация EventEmitter ===\n');

emitter.emit('greet', 'Михаил');
emitter.emit('info', GROUP);
emitter.emit('bye');

const unknownResult = emitter.emit('unknown');
const greetResult = emitter.emit('greet', 'Иван');

console.log(`\nСобытие "unknown" без слушателей: ${unknownResult}`);
console.log(`Событие "greet" со слушателями: ${greetResult}`);
