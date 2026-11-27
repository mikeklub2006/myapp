const { MongoMemoryReplSet } = require('mongodb-memory-server');

// локально mongod не установлен, поэтому поднимаем его через mongodb-memory-server
// реплика-сет rs0 из одного узла на порту 27017, с авторизацией
const PORT = Number(process.env.MONGO_PORT) || 27017;

async function main() {
  console.log('Запуск MongoDB (первый запуск скачивает бинарник mongod, это может занять время)...');

  const replSet = await MongoMemoryReplSet.create({
    replSet: {
      name: 'rs0',
      count: 1,
      auth: {
        enable: true,
        customRootName: 'root',
        customRootPwd: 'root',
        extraUsers: [
          {
            createUser: 'student',
            pwd: 'password',
            database: 'bbmo_401',
            roles: [
              { role: 'readWrite', db: 'bbmo_401' },
              { role: 'dbAdmin', db: 'bbmo_401' },
              { role: 'clusterMonitor', db: 'admin' }
            ]
          }
        ]
      }
    },
    instanceOpts: [{ port: PORT }]
  });

  console.log(`✔ MongoDB запущена: localhost:${PORT}, реплика-сет rs0`);
  console.log(`  URI: mongodb://student:password@localhost:${PORT}/bbmo_401`);
  console.log('Остановка: Ctrl+C');

  const stop = async () => {
    await replSet.stop();
    console.log('MongoDB остановлена');
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error('Не удалось запустить MongoDB:', err.message);
  process.exit(1);
});
