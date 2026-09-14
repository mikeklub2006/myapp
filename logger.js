const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'logs.txt');

function write(event, data) {
  const time = new Date().toISOString();
  const text = typeof data === 'object' ? JSON.stringify(data) : String(data);

  fs.appendFile(logFile, `[${time}] ${event}: ${text}\n`, 'utf8', (err) => {
    if (err) console.error('Не удалось записать лог:', err.message);
  });
}

function setupLogger(app) {
  app.on('server:started', (port) => write('server:started', { port }));
  app.on('request:received', (data) => write('request:received', data));
  app.on('server:stopped', () => write('server:stopped', 'closed'));
}

module.exports = { setupLogger };