const WebSocket = require('ws');

const url = process.argv[2] || 'ws://localhost:3000/ws';
const socket = new WebSocket(url);

socket.on('open', () => console.log(`[WS] Подключен к ${url}`));
socket.on('message', (raw) => {
  const { event, data } = JSON.parse(raw);
  console.log(`[WS] ${event}: ${JSON.stringify(data)}`);
});
socket.on('close', () => console.log('[WS] Соединение закрыто'));
socket.on('error', (err) => console.error('[WS] Ошибка:', err.message));
