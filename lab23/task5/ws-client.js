const WebSocket = require('ws');

const url = process.argv[2] || `ws://localhost:${process.env.WS_PORT || 3001}`;
const socket = new WebSocket(url);

socket.on('open', () => console.log('[WS] Подключен'));
socket.on('message', (raw) => {
  const message = JSON.parse(raw);
  if (message.type === 'hello') return;
  const fields = Object.entries(message.data).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  console.log(`[WS] ${message.type}: { ${fields.join(', ')} }`);
});
socket.on('close', () => console.log('[WS] Отключен'));
socket.on('error', (err) => console.log(`[WS] Ошибка: ${err.message}`));
