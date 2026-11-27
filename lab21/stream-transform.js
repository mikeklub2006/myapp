const { Readable, Writable, Transform } = require('stream');
const { pipeline } = require('stream/promises');
const util = require('util');

const GROUP = '401';

class UpperCaseTransform extends Transform {
  constructor(options) {
    super(options);
    this.prefix = `[${GROUP}]`;
  }

  _transform(chunk, encoding, callback) {
    callback(null, `${this.prefix} ${chunk.toString().toUpperCase()}`);
  }
}

class JsonParserTransform extends Transform {
  constructor() {
    super({ readableObjectMode: true });
    this.tail = '';
  }

  _transform(chunk, encoding, callback) {
    const lines = (this.tail + chunk.toString()).split('\n');
    this.tail = lines.pop();
    for (const line of lines) {
      this.parseLine(line);
    }
    callback();
  }

  _flush(callback) {
    this.parseLine(this.tail);
    callback();
  }

  parseLine(line) {
    if (!line.trim()) return;
    try {
      this.push(JSON.parse(line));
    } catch (err) {
      console.log(`[JSON] Пропущена некорректная строка: ${line}`);
    }
  }
}

class FilterTransform extends Transform {
  constructor(predicate, options) {
    super(Object.assign({ objectMode: true }, options));
    this.predicate = predicate;
    this.passed = 0;
    this.rejected = 0;
  }

  _transform(item, encoding, callback) {
    if (this.predicate(item)) {
      this.passed++;
      callback(null, item);
    } else {
      this.rejected++;
      callback();
    }
  }
}

function show(obj) {
  return util.inspect(obj, { breakLength: Infinity });
}

async function demoUpperCase() {
  console.log('=== Демонстрация Transform-потока ===');
  const inputs = [`группа ${GROUP}`, 'студент клубович михаил'];

  for (const text of inputs) {
    const upper = new UpperCaseTransform();
    const result = await new Promise((resolve) => {
      upper.once('data', (chunk) => resolve(chunk.toString()));
      upper.end(text);
    });
    console.log(`Вход:  "${text}"`);
    console.log(`Выход: "${result}"\n`);
  }
}

async function demoObjectMode() {
  console.log('=== Демонстрация Object Mode (JsonParserTransform + FilterTransform) ===');

  const jsonLines = [
    '{"id": 1, "name": "Михаил", "group": "401"}',
    '{"id": 2, "name": "Мария", "group": "402"}',
    '{"id": 3, "name": "Петр", "group": "401"}',
    'это не json',
    '{"id": 4, "name": "Анна", "group": "403"}'
  ].join('\n');

  const parser = new JsonParserTransform();
  const parsed = [];
  parser.on('data', (obj) => parsed.push(obj));
  await new Promise((resolve) => {
    parser.on('end', resolve);
    parser.end(jsonLines);
  });
  console.log('После JsonParserTransform:');
  parsed.forEach((obj) => console.log(`[OBJECT] ${show(obj)}`));

  const filtered = [];
  await pipeline(
    Readable.from(parsed),
    new FilterTransform((s) => s.group === GROUP),
    new Writable({
      objectMode: true,
      write(obj, encoding, callback) {
        filtered.push(obj);
        callback();
      }
    })
  );

  console.log(`\nПосле фильтрации (только ${GROUP}):`);
  filtered.forEach((obj) => console.log(`[OBJECT] ${show(obj)}`));
  console.log();
}

async function demoAsyncIterator() {
  console.log('=== Демонстрация async iterator ===');

  const readable = Readable.from(['Данные 1', 'Данные 2', 'Данные 3']);
  let n = 0;
  for await (const chunk of readable) {
    n++;
    console.log(`[ASYNC] Получен чанк ${n}: "${chunk}"`);
  }
  console.log('[ASYNC] Поток завершён');

  console.log('\nТо же самое через pipe():');
  await new Promise((resolve) => {
    let k = 0;
    const writer = new Writable({
      objectMode: true,
      write(chunk, encoding, callback) {
        k++;
        console.log(`[PIPE] Получен чанк ${k}: "${chunk}"`);
        callback();
      }
    });
    writer.on('finish', () => {
      console.log('[PIPE] Поток завершён');
      resolve();
    });
    Readable.from(['Данные 1', 'Данные 2', 'Данные 3']).pipe(writer);
  });
  console.log('for await - обычный цикл, можно использовать break/try-catch и await внутри;');
  console.log('pipe() - декларативное соединение, обработка идёт внутри Writable.\n');
}

async function demoChain() {
  console.log('=== Цепочка Transform ===');
  console.log('Читаем → UpperCase → Filter → Записываем\n');

  const lines = [
    'студент иванов, группа 401',
    'студент петров, группа 402',
    'студент клубович, группа 401',
    'студент сидорова, группа 403',
    'студент кузнецов, группа 402',
    'студент смирнова, группа 401',
    'студент попов, группа 404',
    'студент волков, группа 402',
    'студент соколова, группа 405',
    'студент лебедев, группа 403'
  ];

  const upper = new UpperCaseTransform({ objectMode: true });
  upper.on('data', (line) => console.log(`  [UPPER]  ${line}`));

  const filter = new FilterTransform((line) => line.endsWith(GROUP));
  const written = [];

  let read = 0;
  const source = Readable.from(lines).on('data', (line) => {
    read++;
    console.log(`[READ]     ${line}`);
  });

  await pipeline(
    source,
    upper,
    filter,
    new Writable({
      objectMode: true,
      write(line, encoding, callback) {
        written.push(line);
        console.log(`    [WRITE] ${line}`);
        callback();
      }
    })
  );

  console.log(`\n✔ Обработано ${read} строк, отфильтровано ${filter.rejected}, записано ${written.length}`);
}

async function main() {
  await demoUpperCase();
  await demoObjectMode();
  await demoAsyncIterator();
  await demoChain();
}

main().catch((err) => {
  console.error('Ошибка:', err.message);
  process.exitCode = 1;
});
