const { WebSocketServer, WebSocket } = require('ws');
const logger = require('./logger');
const { notifier } = require('./services/notifier');
const { wsClients } = require('./metrics');

function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket, req) => {
    wsClients.set(wss.clients.size);
    logger.info({ ip: req.socket.remoteAddress }, 'WebSocket клиент подключен');
    socket.send(JSON.stringify({ event: 'connected', data: { group: '401' } }));

    socket.on('close', () => wsClients.set(wss.clients.size));
  });

  const broadcast = (message) => {
    const text = JSON.stringify(message);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(text);
    }
  };
  notifier.on('event', broadcast);

  wss.on('close', () => notifier.off('event', broadcast));
  return wss;
}

module.exports = attachWebSocket;
