const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DIR = path.join(__dirname, '..', 'migrations');

async function migrate(db) {
  const applied = db.collection('migrations');
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.js')).sort();
  const done = [];

  for (const file of files) {
    const migration = require(path.join(DIR, file));
    if (await applied.findOne({ name: migration.name })) continue;

    await migration.up(db);
    await applied.insertOne({ name: migration.name, applied_at: new Date() });
    logger.info({ migration: migration.name }, 'Миграция применена');
    done.push(migration.name);
  }
  return done;
}

module.exports = migrate;
