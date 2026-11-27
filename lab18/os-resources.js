const os = require('os');
const { GROUP } = require('./os-info');

const GB = 1024 ** 3;

function getCpuInfo() {
  const cpus = os.cpus();
  const speeds = cpus.map((cpu) => cpu.speed);
  const average = speeds.length ? speeds.reduce((sum, s) => sum + s, 0) / speeds.length : 0;
  return {
    count: cpus.length,
    model: cpus.length ? cpus[0].model.trim() : 'неизвестно',
    speeds,
    averageSpeed: Math.round(average)
  };
}

function getMemoryInfo() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    totalGb: +(total / GB).toFixed(2),
    freeGb: +(free / GB).toFixed(2),
    usedGb: +(used / GB).toFixed(2),
    usedPercent: +((used / total) * 100).toFixed(1),
    freePercent: +((free / total) * 100).toFixed(1)
  };
}

function getLoadAverage() {
  // на windows os.loadavg() всегда возвращает нули
  if (os.platform() === 'win32') return null;
  return os.loadavg().map((v) => +v.toFixed(2));
}

function main() {
  // порог можно поменять для проверки предупреждения: node os-resources.js --min-free 90
  const index = process.argv.indexOf('--min-free');
  const minFree = index !== -1 ? Number(process.argv[index + 1]) : 20;

  const cpu = getCpuInfo();
  const mem = getMemoryInfo();
  const load = getLoadAverage();

  console.log('=== Информация о процессоре ===');
  console.log(`Количество логических ядер: ${cpu.count}`);
  console.log(`Модель процессора:          ${cpu.model}`);
  cpu.speeds.forEach((speed, i) => {
    console.log(`  Ядро ${String(i + 1).padStart(2)}: ${speed} МГц`);
  });
  console.log(`Средняя частота:            ${cpu.averageSpeed} МГц`);

  console.log('\n=== Информация о памяти ===');
  console.log(`Общий объём:   ${mem.totalGb} ГБ`);
  console.log(`Свободно:      ${mem.freeGb} ГБ (${mem.freePercent}%)`);
  console.log(`Использовано:  ${mem.usedGb} ГБ (${mem.usedPercent}%)`);

  console.log('\n=== Средняя загрузка системы ===');
  if (load) {
    console.log(`За 1 мин: ${load[0]}, за 5 мин: ${load[1]}, за 15 мин: ${load[2]}`);
  } else {
    console.log(`os.loadavg(): [${os.loadavg().join(', ')}]`);
    console.log('Средняя загрузка недоступна в Windows');
  }

  console.log();
  console.log(`Группа: ${GROUP}`);
  if (mem.freePercent < minFree) {
    console.log(`⚠ Внимание: свободно меньше ${minFree}% памяти (${mem.freePercent}%)`);
  } else {
    console.log('Память в норме');
  }
}

if (require.main === module) main();

module.exports = { getCpuInfo, getMemoryInfo, getLoadAverage };
