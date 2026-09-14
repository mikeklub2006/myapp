const fs = require('fs');
const util = require('util');

const writeFileAsync = util.promisify(fs.writeFile);
const readFileAsync = util.promisify(fs.readFile);

const DIR = './perf-data';
const COUNT = 300;
const TEXT = 'Тестовая строка';

function prepareDir() {
  if (fs.existsSync(DIR)) {
    fs.rmSync(DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIR);
}

// 1. Синхронно
function testSync() {
  prepareDir();
  const start = Date.now();

  for (let i = 0; i < COUNT; i++) {
    fs.writeFileSync(`${DIR}/sync-${i}.txt`, TEXT, 'utf8');
    fs.readFileSync(`${DIR}/sync-${i}.txt`, 'utf8');
  }

  return Date.now() - start;
}

// 2. Колбэки
function testCallbacks(done) {
  prepareDir();
  const start = Date.now();
  let finished = 0;

  for (let i = 0; i < COUNT; i++) {
    const file = `${DIR}/cb-${i}.txt`;

    fs.writeFile(file, TEXT, 'utf8', () => {
      fs.readFile(file, 'utf8', () => {
        finished++;

        if (finished === COUNT) {
          done(Date.now() - start);
        }
      });
    });
  }
}

// 3. Промисы через Promise.all
async function testPromises() {
  prepareDir();
  const start = Date.now();

  const tasks = [];

  for (let i = 0; i < COUNT; i++) {
    const file = `${DIR}/pr-${i}.txt`;
    tasks.push(writeFileAsync(file, TEXT, 'utf8').then(() => readFileAsync(file, 'utf8')));
  }

  await Promise.all(tasks);
  return Date.now() - start;
}

// 4. Промисы, но с await внутри цикла
async function testAwaitLoop() {
  prepareDir();
  const start = Date.now();

  for (let i = 0; i < COUNT; i++) {
    const file = `${DIR}/seq-${i}.txt`;
    await writeFileAsync(file, TEXT, 'utf8');
    await readFileAsync(file, 'utf8');
  }

  return Date.now() - start;
}

async function run() {
  console.log('Сравнение производительности');
  console.log(`Записываем и читаем ${COUNT} файлов четырьмя способами`);
  console.log('');

  console.log('Синхронно:           ' + testSync() + ' мс');

  const cbTime = await new Promise(resolve => testCallbacks(resolve));
  console.log('Колбэки:             ' + cbTime + ' мс');

  console.log('Promise.all:         ' + (await testPromises()) + ' мс');
  console.log('await в цикле:       ' + (await testAwaitLoop()) + ' мс');

  fs.rmSync(DIR, { recursive: true, force: true });

  console.log('');
  console.log('1. Синхронный способ блокирует программу, она ждёт каждый файл');
  console.log('и в это время не может делать ничего другого');
  console.log('2. Колбэки и Promise.all запускают все файлы сразу, не дожидаясь');
  console.log('предыдущего, поэтому на большом количестве файлов выигрывают');
  console.log('3. await в цикле выглядит асинхронным, но ждёт каждый файл по');
  console.log('очереди, поэтому по времени близок к синхронному');
}

run();