const fs = require('fs');

const size = Number(process.argv[2]) || 2 * 1024 * 1024;
const items = [];
let length = 2;
while (length < size) {
  const item = JSON.stringify({ id: items.length + 1, group: '401', text: 'x'.repeat(100) });
  items.push(item);
  length += item.length + 1;
}
fs.writeFileSync('large-file.json', '[' + items.join(',') + ']');
console.log(`Создан large-file.json, ${fs.statSync('large-file.json').size} байт`);
