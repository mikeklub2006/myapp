const { MongoClient } = require('mongodb');
const config = require('./config');
const logger = require('./logger');

let client = null;
let db = null;
let memoryServer = null;

async function connect(uri = config.mongoUri, dbName = config.dbName) {
  if (!uri) {
    if (config.env === 'production') throw new Error('MONGO_URI не задан');
    // для локального запуска без установленной mongodb
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
    logger.warn('MONGO_URI не задан, используется MongoDB в памяти');
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  logger.info({ db: dbName }, 'MongoDB подключена');
  return db;
}

function getDb() {
  if (!db) throw new Error('База данных не подключена');
  return db;
}

async function ping() {
  if (!db) return false;
  try {
    await db.command({ ping: 1 });
    return true;
  } catch (err) {
    return false;
  }
}

async function close() {
  if (client) await client.close();
  if (memoryServer) await memoryServer.stop();
  client = null;
  db = null;
  memoryServer = null;
}

module.exports = { connect, getDb, ping, close };
