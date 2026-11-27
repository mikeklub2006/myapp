require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { MongoClient } = require('mongodb');

const config = {
  uri: process.env.MONGO_URI || 'mongodb://student:password@localhost:27017/bbmo_401',
  dbName: process.env.DB_NAME || 'bbmo_401',
  group: '401',
  port: Number(process.env.PORT) || 3000,
  wsPort: Number(process.env.WS_PORT) || 3001,
  cacheTtl: 60 * 1000
};

let client = null;

async function connect() {
  client = new MongoClient(config.uri, { maxPoolSize: 20, serverSelectionTimeoutMS: 5000 });
  await client.connect();
  return client;
}

function getClient() {
  return client;
}

function getDb() {
  return client.db(config.dbName);
}

async function close() {
  if (client) await client.close();
}

module.exports = { config, connect, getClient, getDb, close };
