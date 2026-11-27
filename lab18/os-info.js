const os = require('os');

const GROUP = '401';

function formatUptime(seconds) {
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const time = `${hours} ч ${minutes} мин ${secs} сек`;
  return days > 0 ? `${days} д ${time}` : time;
}

function platformMessage(platform) {
  switch (platform) {
    case 'win32':
      return 'Вы работаете в Windows';
    case 'linux':
      return 'Вы работаете в Linux';
    case 'darwin':
      return 'Вы работаете в macOS';
    default:
      return 'Неизвестная платформа';
  }
}

function getSystemInfo() {
  return {
    platform: os.platform(),
    type: os.type(),
    arch: os.arch(),
    release: os.release(),
    hostname: os.hostname(),
    uptime: os.uptime()
  };
}

function main() {
  const info = getSystemInfo();

  console.log(`=== Информация о системе (группа ${GROUP}) ===`);
  console.log(`Платформа:     ${info.platform}`);
  console.log(`Тип ОС:        ${info.type}`);
  console.log(`Архитектура:   ${info.arch}`);
  console.log(`Версия ОС:     ${info.release}`);
  console.log(`Имя хоста:     ${info.hostname}`);
  console.log(`Время работы:  ${formatUptime(info.uptime)} (${Math.floor(info.uptime)} сек)`);
  console.log();
  console.log(platformMessage(info.platform));
}

if (require.main === module) main();

module.exports = { GROUP, getSystemInfo, formatUptime, platformMessage };
