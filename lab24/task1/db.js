const { MongoClient } = require('mongodb');

let client = null;
let memoryServer = null;

async function connect() {
  let uri = process.env.MONGO_URI;

  // если сервер mongodb не указан - поднимаем временный в памяти
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
    console.log('[INFO] MONGO_URI не задан, используется MongoDB в памяти');
  }

  client = new MongoClient(uri);
  await client.connect();
  return client.db(process.env.DB_NAME || 'bbmo_401');
}

async function close() {
  if (client) await client.close();
  if (memoryServer) await memoryServer.stop();
}

module.exports = { connect, close };
