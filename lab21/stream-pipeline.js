const fs = require('fs');
const path = require('path');
const { Readable, Writable, Transform } = require('stream');
const { pipeline } = require('stream/promises');

const GROUP = '401';
const TOTAL = 10000;
const PORTION = 100;
const TIMEOUT = 10000;
const CSV_FILE = path.join(__dirname, 'students.csv');
const CSV_ASYNC_FILE = path.join(__dirname, 'students-async.csv');
const CSV_TIMEOUT_FILE = path.join(__dirname, 'students-timeout.csv');
const ERRORS_LOG = path.join(__dirname, 'errors.log');

const FIRST_NAMES = ['Иван', 'Мария', 'Михаил', 'Анна', 'Петр', 'Елена', 'Алексей', 'Ольга', 'Дмитрий', 'Наталья', 'Сергей', 'Татьяна'];
const LAST_NAMES = ['Иванов', 'Петров', 'Клубович', 'Смирнов', 'Кузнецов', 'Попов', 'Волков', 'Соколов', 'Лебедев', 'Козлов', 'Новиков', 'Морозов'];

// генератор псевдослучайных чисел mulberry32, seed = номер группы
function createRandom(seed) {
  let a = seed;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function logError(message) {
  fs.appendFileSync(ERRORS_LOG, `[${timestamp()}] [${GROUP}] ${message}\n`);
}

class StudentSource extends Readable {
  constructor(options = {}) {
    super({ objectMode: true, highWaterMark: PORTION });
    this.total = options.total || TOTAL;
    this.delay = options.delay || 0;
    this.random = createRandom(Number(GROUP));
    this.nextId = 1;
    this.generated = 0;
    this.timer = null;
  }

  makeStudent() {
    const r = this.random;
    const student = {
      id: this.nextId++,
      name: `${FIRST_NAMES[Math.floor(r() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(r() * LAST_NAMES.length)]}`,
      group: GROUP,
      course: 1 + Math.floor(r() * 4),
      grade: Math.round((2 + r() * 3) * 10) / 10
    };
    // немного битых записей, чтобы было что отсеивать на валидации
    const broken = r();
    if (broken < 0.0007) delete student.name;
    else if (broken < 0.0014) student.grade = Math.round(r() * 10) + 6;
    return student;
  }

  _read() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.generated >= this.total) {
        this.push(null);
        return;
      }
      const count = Math.min(PORTION, this.total - this.generated);
      for (let i = 0; i < count; i++) {
        this.generated++;
        this.push(this.makeStudent());
      }
    }, this.delay);
  }

  _destroy(err, callback) {
    clearTimeout(this.timer);
    callback(err);
  }
}

function validate(student) {
  if (typeof student.name !== 'string' || student.name.trim().length < 2) return 'отсутствует name';
  if (!Number.isInteger(student.course) || student.course < 1 || student.course > 4) return 'некорректный course';
  if (typeof student.grade !== 'number' || student.grade < 0 || student.grade > 5) return 'некорректный grade';
  return null;
}

class ValidateTransform extends Transform {
  constructor(stats) {
    super({ objectMode: true, highWaterMark: PORTION });
    this.stats = stats;
  }

  _transform(student, encoding, callback) {
    this.stats.processed++;
    const problem = validate(student);
    if (problem) {
      this.stats.errors++;
      logError(`Ошибка валидации: id=${student.id}, ${problem}`);
      return callback();
    }
    this.stats.valid++;
    callback(null, student);
  }
}

class EnrichTransform extends Transform {
  constructor(stats) {
    super({ objectMode: true, highWaterMark: PORTION });
    this.stats = stats;
    this.sums = {};
    this.counts = {};
  }

  _transform(student, encoding, callback) {
    // averageGrade - средний балл по курсу студента на момент обработки
    const c = student.course;
    this.sums[c] = (this.sums[c] || 0) + student.grade;
    this.counts[c] = (this.counts[c] || 0) + 1;
    this.stats.enriched++;
    callback(null, Object.assign({}, student, { averageGrade: Math.round((this.sums[c] / this.counts[c]) * 10) / 10 }));
  }
}

class FilterTransform extends Transform {
  constructor(stats, minGrade) {
    super({ objectMode: true, highWaterMark: PORTION });
    this.stats = stats;
    this.minGrade = minGrade;
  }

  _transform(student, encoding, callback) {
    if (student.grade > this.minGrade) {
      this.stats.filtered++;
      callback(null, student);
    } else {
      callback();
    }
  }
}

function toCsv(s) {
  return `${s.id},${s.name},${s.group},${s.course},${s.grade},${s.averageGrade}\n`;
}

class FormatTransform extends Transform {
  constructor() {
    super({ writableObjectMode: true, readableObjectMode: false, highWaterMark: 16 * 1024 });
    this.headerDone = false;
  }

  _transform(student, encoding, callback) {
    let line = toCsv(student);
    if (!this.headerDone) {
      line = 'id,name,group,course,grade,averageGrade\n' + line;
      this.headerDone = true;
    }
    callback(null, line);
  }
}

class CsvWriter extends Writable {
  constructor(file, stats, onProgress) {
    super({ highWaterMark: 16 * 1024 });
    this.stats = stats;
    this.onProgress = onProgress;
    // маленький буфер у файла, чтобы backpressure реально возникал
    this.file = fs.createWriteStream(file, { highWaterMark: 4 * 1024 });
    this.file.on('error', (err) => this.destroy(err));
  }

  _write(chunk, encoding, callback) {
    const rows = chunk.toString().split('\n').filter((l) => l && !l.startsWith('id,')).length;
    this.stats.written += rows;
    if (this.onProgress) this.onProgress();

    if (this.file.write(chunk)) return callback();

    const pausedAt = Date.now();
    const record = this.stats.written;
    this.file.once('drain', () => {
      this.stats.pauses.push({ record, ms: Date.now() - pausedAt });
      callback();
    });
  }

  _final(callback) {
    this.file.end(callback);
  }

  _destroy(err, callback) {
    this.file.destroy();
    callback(err);
  }
}

function createStats() {
  return { processed: 0, valid: 0, enriched: 0, filtered: 0, written: 0, errors: 0, pauses: [] };
}

function progressBar(done, total, startTime) {
  const width = 20;
  const percent = Math.floor((done / total) * 100);
  const filled = Math.round((done / total) * width);
  const seconds = (Date.now() - startTime) / 1000;
  const speed = seconds > 0 ? Math.round(done / seconds) : 0;
  return `[PROGRESS] ${'█'.repeat(filled)}${'░'.repeat(width - filled)} ${String(percent).padStart(3)}% | ${done}/${total} | ${speed} записей/сек`;
}

function buildStreams(file, stats, options, onProgress) {
  const streams = {
    source: new StudentSource(options),
    validate: new ValidateTransform(stats),
    enrich: new EnrichTransform(stats),
    filter: new FilterTransform(stats, 3),
    format: new FormatTransform(),
    writer: new CsvWriter(file, stats, onProgress)
  };
  for (const [name, stream] of Object.entries(streams)) {
    stream.on('error', (err) => logError(`Ошибка в потоке ${name}: ${err.name}: ${err.message}`));
  }
  return streams;
}

async function runPipeline(file, options, timeout) {
  const stats = createStats();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const start = Date.now();
  let nextStep = 20;

  const streams = buildStreams(file, stats, options, () => {
    if (!options.quiet) {
      const percent = (stats.processed / options.total) * 100;
      if (percent >= nextStep) {
        console.log(progressBar(stats.processed, options.total, start));
        nextStep += 20;
      }
    }
  });

  try {
    await pipeline(Object.values(streams), { signal: controller.signal });
    if (!options.quiet && nextStep <= 100) {
      console.log(progressBar(stats.processed, options.total, start));
    }
    return { stats, streams, time: (Date.now() - start) / 1000, aborted: false };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { stats, streams, time: (Date.now() - start) / 1000, aborted: true };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function runAsyncIterator(file) {
  const stats = createStats();
  const start = Date.now();
  const source = new StudentSource({ total: TOTAL });
  const out = fs.createWriteStream(file);
  const sums = {};
  const counts = {};

  out.write('id,name,group,course,grade,averageGrade\n');
  try {
    for await (const student of source) {
      stats.processed++;
      if (validate(student)) {
        stats.errors++;
        continue;
      }
      const c = student.course;
      sums[c] = (sums[c] || 0) + student.grade;
      counts[c] = (counts[c] || 0) + 1;
      student.averageGrade = Math.round((sums[c] / counts[c]) * 10) / 10;
      if (student.grade <= 3) continue;
      stats.filtered++;
      if (!out.write(toCsv(student))) {
        await new Promise((resolve) => out.once('drain', resolve));
      }
      stats.written++;
    }
  } finally {
    await new Promise((resolve) => out.end(resolve));
  }
  return { stats, time: (Date.now() - start) / 1000 };
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${(bytes / 1024).toFixed(1)} КБ`;
}

async function main() {
  fs.writeFileSync(ERRORS_LOG, '');

  console.log(`=== Конвейер обработки данных (группа ${GROUP}) ===`);
  console.log(`Источник: ${TOTAL} студентов`);
  console.log('Фильтр: оценка > 3');
  console.log(`Таймаут: ${TIMEOUT / 1000} сек\n`);

  const main = await runPipeline(CSV_FILE, { total: TOTAL, delay: 20 }, TIMEOUT);
  const s = main.stats;

  if (main.aborted) {
    console.log('✖ Основной конвейер не уложился в таймаут');
  }

  console.log('\n=== Результаты ===');
  console.log(`Всего сгенерировано: ${main.streams.source.generated}`);
  console.log(`Прошло валидацию:    ${s.valid}`);
  console.log(`Обогащено:           ${s.enriched}`);
  console.log(`Отфильтровано:       ${s.filtered}`);
  console.log(`Записано в CSV:      ${s.written}`);
  console.log(`Ошибок:              ${s.errors}`);
  console.log(`Время выполнения:    ${main.time.toFixed(2)} сек`);
  console.log(`Средняя скорость:    ${Math.round(s.processed / main.time)} записей/сек`);
  console.log(`\nФайл: ${path.basename(CSV_FILE)} (${formatSize(fs.statSync(CSV_FILE).size)})`);

  console.log('\n=== Демонстрация backpressure ===');
  if (s.pauses.length === 0) {
    console.log('Буфер ни разу не переполнился');
  } else {
    for (const p of s.pauses.slice(0, 3)) {
      console.log(`[BACKPRESSURE] Writable переполнен на ${p.record}-й записи`);
      console.log(`[BACKPRESSURE] Пауза ${p.ms} мс`);
      console.log('[DRAIN] Продолжаем запись');
    }
    const totalPause = s.pauses.reduce((sum, p) => sum + p.ms, 0);
    console.log(`Всего приостановок: ${s.pauses.length}, суммарная пауза: ${totalPause} мс`);
  }

  console.log('\n=== Отмена по таймауту ===');
  console.log('Запуск с таймаутом 1 сек...');
  const slow = await runPipeline(CSV_TIMEOUT_FILE, { total: TOTAL, delay: 50, quiet: true }, 1000);
  if (slow.aborted) {
    console.log(`✖ Таймаут! Обработка отменена (успели обработать ${slow.stats.processed} из ${TOTAL})`);
    logError(`Таймаут: обработка отменена после ${slow.stats.processed} записей`);
  } else {
    console.log('Обработка успела завершиться до таймаута');
  }
  // ждём закрытия файлового дескриптора
  await new Promise((resolve) => setTimeout(resolve, 50));
  const allClosed = Object.values(slow.streams).every((st) => st.destroyed) && slow.streams.writer.file.destroyed;
  if (allClosed) {
    console.log('✔ Все потоки корректно закрыты');
    console.log('✔ Ресурсы освобождены');
  } else {
    console.log('✖ Не все потоки закрыты');
  }
  fs.rmSync(CSV_TIMEOUT_FILE, { force: true });

  console.log('\n=== Сравнение с async iterator ===');
  const it = await runAsyncIterator(CSV_ASYNC_FILE);
  console.log(`[ASYNC] Обработано: ${it.stats.written} записей за ${it.time.toFixed(2)} сек`);
  console.log(`Скорость: ${Math.round(it.stats.processed / it.time)} записей/сек`);
  console.log(`[PIPELINE] Обработано: ${s.written} записей за ${main.time.toFixed(2)} сек`);
  const same = fs.readFileSync(CSV_ASYNC_FILE, 'utf8') === fs.readFileSync(CSV_FILE, 'utf8');
  console.log(`Результаты совпадают: ${same ? 'да' : 'нет'}`);

  console.log(`\nОшибки записаны в ${path.basename(ERRORS_LOG)}`);
}

main().catch((err) => {
  logError(`Критическая ошибка: ${err.message}`);
  console.error(`✖ Ошибка: ${err.message}`);
  process.exitCode = 1;
});
