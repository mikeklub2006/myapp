const fs = require('fs');
const path = require('path');
const { pipeline, Transform } = require('stream');

const INPUT = path.join(__dirname, 'input.txt');
const MISSING = path.join(__dirname, 'missing.txt');
const OUT_PIPE = path.join(__dirname, 'output-pipe.txt');
const OUT_PIPE_ERR = path.join(__dirname, 'output-pipe-error.txt');
const OUT_PIPELINE = path.join(__dirname, 'output-pipeline.txt');
const OUT_PIPELINE_ERR = path.join(__dirname, 'output-pipeline-error.txt');
const OUT_CHAIN = path.join(__dirname, 'output-chain.txt');

function sameContent(a, b) {
  return fs.readFileSync(a).equals(fs.readFileSync(b));
}

function demoPipe() {
  return new Promise((resolve) => {
    console.log('=== Демонстрация pipe() ===');
    console.log(`Чтение: ${path.basename(INPUT)}`);
    console.log(`Запись: ${path.basename(OUT_PIPE)}`);

    const source = fs.createReadStream(INPUT);
    const dest = fs.createWriteStream(OUT_PIPE);

    source.on('error', (err) => console.log(`✖ Ошибка чтения: ${err.message}`));
    dest.on('finish', () => {
      console.log('✔ Копирование завершено');
      console.log(`Размер: ${fs.statSync(OUT_PIPE).size} байт`);
      console.log(`Содержимое совпадает с input.txt: ${sameContent(INPUT, OUT_PIPE) ? 'да' : 'нет'}\n`);
      resolve();
    });

    source.pipe(dest);
  });
}

function demoPipeError() {
  return new Promise((resolve) => {
    console.log('=== Демонстрация pipe() с ошибкой ===');
    console.log(`Чтение: ${path.basename(MISSING)}`);

    const source = fs.createReadStream(MISSING);
    const dest = fs.createWriteStream(OUT_PIPE_ERR);

    source.on('error', (err) => {
      console.log(`✖ Ошибка: ${err.message.split(',')[0]}`);
      // даём время, чтобы было видно, что dest так и висит открытым
      setTimeout(() => {
        console.log(`source.destroyed = ${source.destroyed}`);
        console.log(`dest.destroyed = ${dest.destroyed}, dest.writableEnded = ${dest.writableEnded}`);
        if (!dest.destroyed) {
          console.log('⚠ Внимание: pipe() не закрыл целевой поток!');
          console.log('⚠ Возможна утечка памяти (файловый дескриптор остаётся открытым).');
        }
        // закрываем вручную
        dest.destroy();
        dest.on('close', () => {
          console.log('Целевой поток пришлось закрыть вручную через destroy()\n');
          resolve();
        });
      }, 100);
    });

    source.pipe(dest);
  });
}

function demoPipeline() {
  return new Promise((resolve) => {
    console.log('=== Демонстрация pipeline() ===');
    console.log(`Чтение: ${path.basename(INPUT)}`);
    console.log(`Запись: ${path.basename(OUT_PIPELINE)}`);

    pipeline(fs.createReadStream(INPUT), fs.createWriteStream(OUT_PIPELINE), (err) => {
      if (err) {
        console.log(`✖ Ошибка: ${err.message}\n`);
      } else {
        console.log('✔ Копирование завершено');
        console.log(`Размер: ${fs.statSync(OUT_PIPELINE).size} байт`);
        console.log(`Содержимое совпадает с input.txt: ${sameContent(INPUT, OUT_PIPELINE) ? 'да' : 'нет'}\n`);
      }
      resolve();
    });
  });
}

function demoPipelineError() {
  return new Promise((resolve) => {
    console.log('=== Демонстрация pipeline() с ошибкой ===');
    console.log(`Чтение: ${path.basename(MISSING)}`);

    const source = fs.createReadStream(MISSING);
    const dest = fs.createWriteStream(OUT_PIPELINE_ERR);

    pipeline(source, dest, (err) => {
      if (err) {
        console.log(`✖ Ошибка: ${err.message.split(',')[0]}`);
      }
      setTimeout(() => {
        console.log(`source.destroyed = ${source.destroyed}`);
        console.log(`dest.destroyed = ${dest.destroyed}`);
        if (source.destroyed && dest.destroyed) {
          console.log('✔ Все потоки автоматически закрыты');
          console.log('✔ Утечек нет\n');
        }
        resolve();
      }, 100);
    });
  });
}

class UpperCase extends Transform {
  _transform(chunk, encoding, callback) {
    callback(null, chunk.toString().toUpperCase());
  }
}

class ReverseLines extends Transform {
  constructor() {
    super();
    this.tail = '';
  }

  _transform(chunk, encoding, callback) {
    const lines = (this.tail + chunk.toString()).split('\n');
    this.tail = lines.pop();
    const result = lines.map((line) => line.split('').reverse().join('') + '\n').join('');
    callback(null, result);
  }

  _flush(callback) {
    if (this.tail) this.push(this.tail.split('').reverse().join(''));
    callback();
  }
}

function demoChain() {
  return new Promise((resolve) => {
    console.log('=== Цепочка потоков ===');
    console.log('input.txt → uppercase → reverse → output-chain.txt');

    const source = fs.createReadStream(INPUT);
    const dest = fs.createWriteStream(OUT_CHAIN);

    dest.on('finish', () => {
      console.log('✔ Обработка завершена');
      const first = fs.readFileSync(INPUT, 'utf8').split('\n')[0];
      const result = fs.readFileSync(OUT_CHAIN, 'utf8').split('\n')[0];
      console.log(`Было:  ${first}`);
      console.log(`Стало: ${result}`);
      resolve();
    });

    source.pipe(new UpperCase()).pipe(new ReverseLines()).pipe(dest);
  });
}

async function main() {
  await demoPipe();
  await demoPipeError();
  await demoPipeline();
  await demoPipelineError();
  await demoChain();
}

main();
