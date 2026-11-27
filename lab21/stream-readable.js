const { Readable } = require('stream');

class InfoStream extends Readable {
  constructor(lines, options) {
    super(options);
    this.lines = lines;
    this.index = 0;
  }

  _read(size) {
    if (this.index < this.lines.length) {
      this.push(this.lines[this.index]);
      this.index++;
    } else {
      this.push(null);
    }
  }
}

const lines = [
  'Группа: 401',
  'Студент: Клубович Михаил',
  'Лабораторная работа: №21',
  'Тема: Потоки в Node.js'
];

const stream = new InfoStream(lines);

let count = 0;
let totalBytes = 0;

console.log('=== Демонстрация Readable-потока ===\n');

stream.on('data', (chunk) => {
  count++;
  totalBytes += chunk.length;
  console.log(`[CHUNK ${count}] ${chunk.toString()}`);
});

stream.on('end', () => {
  console.log('\n[END] Поток завершён');
  console.log(`Всего получено чанков: ${count}`);
  console.log(`Общий размер данных: ${totalBytes} байт`);
});

stream.on('error', (err) => {
  console.error(`[ERROR] ${err.message}`);
});
