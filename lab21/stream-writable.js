const { Writable } = require('stream');

class ConsoleWriter extends Writable {
  constructor(options) {
    super(options);
    this.count = 0;
  }

  _write(chunk, encoding, callback) {
    this.count++;
    console.log(`[WRITE] ${chunk.toString()}`);
    // имитация медленной записи
    setTimeout(() => callback(), 100);
  }
}

// decodeStrings: false, чтобы длина буфера считалась в символах, а не в байтах
const writer = new ConsoleWriter({ highWaterMark: 16, decodeStrings: false });

const data = [
  'Группа: 401',
  'Студент: Клубович Михаил',
  'Лабораторная работа: №21',
  'Тема: Потоки в Node.js'
];
for (let i = 1; i <= 8; i++) {
  data.push(`msg-${i}`);
}

let falseCount = 0;
let drainCount = 0;

writer.on('drain', () => {
  drainCount++;
  console.log('\n[DRAIN] Буфер освобождён, продолжаем запись');
});

writer.on('finish', () => {
  console.log('\n[FINISH] Все данные записаны');
  console.log(`Всего записано: ${writer.count} чанков`);
  console.log(`write() вернул false: ${falseCount} раз, событий drain: ${drainCount}`);
});

writer.on('error', (err) => {
  console.error(`[ERROR] ${err.message}`);
});

console.log('=== Демонстрация Writable-потока ===\n');
console.log(`highWaterMark: ${writer.writableHighWaterMark}\n`);

let i = 0;

function writeNext() {
  while (i < data.length) {
    const ok = writer.write(data[i]);
    i++;
    if (ok) {
      console.log('write() вернул: true');
    } else {
      falseCount++;
      console.log(`write() вернул: false  <- буфер переполнен! (в буфере ${writer.writableLength})`);
      writer.once('drain', writeNext);
      return;
    }
  }
  writer.end();
}

writeNext();
