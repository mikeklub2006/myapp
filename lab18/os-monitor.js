const os = require('os');
const fs = require('fs');
const path = require('path');
const { GROUP, getSystemInfo } = require('./os-info');
const { getCpuInfo, getMemoryInfo, getLoadAverage } = require('./os-resources');
const { getInterfaces, findMain, getUser } = require('./os-network');

const LOG_FILE = path.join(__dirname, 'monitor.log');

function getArg(name, def) {
  const i = process.argv.indexOf(name);
  if (i === -1 || process.argv[i + 1] === undefined) return def;
  return Number(process.argv[i + 1]);
}

const settings = {
  interval: getArg('--interval', 2000),
  count: getArg('--count', 0),
  cpuWarn: getArg('--cpu-warn', 50),
  cpuCritical: getArg('--cpu-critical', 80),
  memWarn: getArg('--mem-warn', 10)
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function timestamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function collectSnapshot() {
  const interfaces = getInterfaces();
  const cpu = getCpuInfo();
  return {
    timestamp: new Date().toISOString(),
    group: GROUP,
    system: getSystemInfo(),
    cpu: { count: cpu.count, model: cpu.model, averageSpeed: cpu.averageSpeed },
    memory: getMemoryInfo(),
    loadavg: getLoadAverage(),
    network: { count: interfaces.length, main: findMain(interfaces), interfaces },
    user: getUser()
  };
}

function cpuTimes() {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    const t = cpu.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.idle + t.irq;
  }
  return { idle, total };
}

function cpuUsage(prev, curr) {
  const totalDiff = curr.total - prev.total;
  const idleDiff = curr.idle - prev.idle;
  const busyDiff = totalDiff - idleDiff;
  const percent = totalDiff > 0 ? (busyDiff / totalDiff) * 100 : 0;
  return { busyDiff, totalDiff, percent: +percent.toFixed(1) };
}

function writeLog(message) {
  fs.appendFileSync(LOG_FILE, `[${timestamp()}] [${GROUP}] Предупреждение: ${message}\n`, 'utf8');
}

function check(cpu, mem) {
  const problems = [];
  let mark = '';

  if (cpu.percent > settings.cpuCritical) {
    problems.push(`критическая загрузка CPU ${cpu.percent}% (порог ${settings.cpuCritical}%)`);
    mark = '⚠⚠';
  } else if (cpu.percent > settings.cpuWarn) {
    problems.push(`высокая загрузка CPU ${cpu.percent}% (порог ${settings.cpuWarn}%)`);
    mark = '⚠';
  }

  if (mem.freePercent < settings.memWarn) {
    problems.push(`мало свободной памяти: ${mem.freePercent}% (${mem.freeGb} ГБ)`);
    mark += ' RAM⚠';
  }

  return { problems, mark: mark.trim() };
}

function main() {
  const snapshot = collectSnapshot();
  console.log(`Первичный слепок системы (${snapshot.timestamp}):`);
  // список интерфейсов длинный, в консоль выводим только количество и основной
  const short = { ...snapshot, network: { count: snapshot.network.count, main: snapshot.network.main } };
  console.log(JSON.stringify(short, null, 2));
  console.log();

  console.log(`Мониторинг (группа ${GROUP}). Ctrl+C для выхода.`);
  console.log(`Интервал: ${settings.interval} мс, пороги CPU: ${settings.cpuWarn}% / ${settings.cpuCritical}%, RAM: < ${settings.memWarn}% свободно`);
  console.log('Загрузка = busy_diff / total_diff * 100\n');

  let prev = cpuTimes();
  let warnings = 0;
  let ticks = 0;
  let lastLength = 0;

  const timer = setInterval(() => {
    const curr = cpuTimes();
    const cpu = cpuUsage(prev, curr);
    prev = curr;
    const mem = getMemoryInfo();
    const status = check(cpu, mem);

    let line = `CPU: ${cpu.percent}% (${cpu.busyDiff}/${cpu.totalDiff} мс) | RAM: ${mem.usedPercent}% (${mem.freeGb} ГБ свободно)`;
    if (status.mark) line += ` ${status.mark}`;
    else line += ' норма';

    // \r возвращает курсор в начало строки, хвост от прошлой строки затираем пробелами
    process.stdout.write('\r' + line.padEnd(lastLength));
    lastLength = line.length;

    if (status.problems.length) {
      warnings++;
      status.problems.forEach(writeLog);
      // строку с предупреждением оставляем на экране
      process.stdout.write('\n');
      lastLength = 0;
    }

    ticks++;
    if (settings.count && ticks >= settings.count) stop();
  }, settings.interval);

  function stop() {
    clearInterval(timer);
    process.stdout.write('\n');
    console.log(`Мониторинг остановлен. Предупреждений: ${warnings}`);
    if (warnings) console.log(`Журнал: ${path.basename(LOG_FILE)}`);
    process.exit(0);
  }

  process.on('SIGINT', stop);
}

if (require.main === module) main();

module.exports = { collectSnapshot, cpuTimes, cpuUsage, timestamp };
