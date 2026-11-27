const fs = require('fs');
const path = require('path');
const config = require('../config');

fs.mkdirSync(path.dirname(config.logFile), { recursive: true });

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function info(message) {
  console.log(`[INFO] ${message}`);
}

function sql(message) {
  const line = `[${timestamp()}] [${config.group}] ${message}`;
  console.log(line);
  fs.appendFile(config.logFile, line + '\n', () => {});
}

function error(message) {
  const line = `[${timestamp()}] [${config.group}] [ERROR] ${message}`;
  console.error(line);
  fs.appendFile(config.logFile, line + '\n', () => {});
}

module.exports = { info, sql, error, timestamp };
