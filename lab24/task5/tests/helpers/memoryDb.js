const { MongoMemoryServer } = require('mongodb-memory-server');
const db = require('../../src/db');
const migrate = require('../../src/migrate');

let server = null;

async function startDb() {
  server = await MongoMemoryServer.create();
  const database = await db.connect(server.getUri(), 'bbmo_401_test');
  await migrate(database);
  return { database, uri: server.getUri() };
}

async function clearUsers() {
  await db.getDb().collection('users').deleteMany({});
  await db.getDb().collection('refresh_tokens').deleteMany({});
}

async function stopDb() {
  await db.close();
  if (server) await server.stop();
}

module.exports = { startDb, clearUsers, stopDb };
