const os = require('os');
const { GROUP } = require('./os-info');

function maskMac(mac) {
  const parts = mac.split(':');
  return parts.slice(0, 3).map((p) => p.toUpperCase()).concat(['**', '**', '**']).join(':');
}

function getInterfaces() {
  const list = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    const ipv4 = addrs.filter((a) => a.family === 'IPv4' || a.family === 4);
    const ipv6 = addrs.filter((a) => a.family === 'IPv6' || a.family === 6);
    list.push({
      name,
      ipv4: ipv4.map((a) => a.address),
      ipv6: ipv6.map((a) => a.address),
      mac: addrs.length ? maskMac(addrs[0].mac) : '-',
      internal: addrs.every((a) => a.internal)
    });
  }
  return list;
}

function findMain(interfaces) {
  for (const item of interfaces) {
    if (!item.internal && item.ipv4.length) return { name: item.name, address: item.ipv4[0] };
  }
  return null;
}

function getUser() {
  const user = os.userInfo();
  const isWindows = os.platform() === 'win32';
  return {
    username: user.username,
    uid: user.uid,
    gid: user.gid,
    homedir: user.homedir,
    shell: user.shell || process.env.ComSpec || 'неизвестно',
    // на windows uid = -1, поэтому проверяем по имени
    isRoot: isWindows ? user.username.toLowerCase() === 'administrator' : user.uid === 0
  };
}

function main() {
  const interfaces = getInterfaces();

  console.log('=== Сетевые интерфейсы ===');
  for (const item of interfaces) {
    console.log(`Интерфейс: ${item.name}`);
    item.ipv4.forEach((ip) => console.log(`  IPv4:       ${ip}`));
    item.ipv6.forEach((ip) => console.log(`  IPv6:       ${ip}`));
    console.log(`  MAC:        ${item.mac}`);
    console.log(`  Внутренний: ${item.internal ? 'да' : 'нет'}`);
  }

  const primary = findMain(interfaces);
  console.log();
  console.log(`Всего интерфейсов:   ${interfaces.length}`);
  console.log(`Основной интерфейс:  ${primary ? `${primary.name} (${primary.address})` : 'не найден'}`);

  const user = getUser();
  console.log('\n=== Информация о пользователе ===');
  console.log(`Имя пользователя:     ${user.username}`);
  if (user.uid === -1) {
    console.log('UID / GID:            недоступно в Windows');
  } else {
    console.log(`UID:                  ${user.uid}`);
    console.log(`GID:                  ${user.gid}`);
  }
  console.log(`Домашняя директория:  ${user.homedir}`);
  console.log(`Оболочка:             ${user.shell}`);
  console.log();
  console.log(`Группа:               ${GROUP}`);
  console.log(`Проверка root:        ${user.isRoot ? 'да - запуск от root не рекомендуется!' : 'нет'}`);
}

if (require.main === module) main();

module.exports = { maskMac, getInterfaces, findMain, getUser };
