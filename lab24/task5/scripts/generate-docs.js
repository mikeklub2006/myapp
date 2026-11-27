const fs = require('fs');
const path = require('path');
const spec = require('../src/swagger');

const file = path.join(__dirname, '..', 'docs', 'openapi.json');
fs.writeFileSync(file, JSON.stringify(spec, null, 2) + '\n', 'utf8');
console.log(`Спецификация сохранена: ${file} (${Object.keys(spec.paths).length} путей)`);
