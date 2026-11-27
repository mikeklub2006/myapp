const pino = require('pino');
const config = require('./config');

// логи пишутся в stdout в формате json
const logger = pino({
  level: config.logLevel,
  base: { group: config.group },
  timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = logger;
