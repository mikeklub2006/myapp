const { WebSocketServer, WebSocket } = require('ws');
const { info, log } = require('../middleware/logger');

function short(change) {
  const id = change.documentKey ? String(change.documentKey._id) : undefined;
  if (change.operationType === 'insert' || change.operationType === 'replace') {
    return { _id: id, name: change.fullDocument.name };
  }
  if (change.operationType === 'update') {
    const fields = { ...change.updateDescription.updatedFields };
    delete fields.updated_at;
    return { _id: id, ...fields };
  }
  return { _id: id };
}

function startStream(collection, port, onChange) {
  const wss = new WebSocketServer({ port });
  let stream = null;
  let stopped = false;

  wss.on('connection', (socket) => {
    log(`WebSocket клиент подключен (всего ${wss.clients.size})`);
    socket.send(JSON.stringify({ type: 'hello', message: 'Подписка на изменения students' }));
  });

  function broadcast(message) {
    const text = JSON.stringify(message);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(text);
    }
  }

  async function watch() {
    stream = collection.watch([], { fullDocument: 'updateLookup' });
    try {
      for await (const change of stream) {
        const data = short(change);
        log(`[STREAM] ${change.operationType}: ${JSON.stringify(data)}`);
        if (onChange) onChange(change);
        broadcast({ type: change.operationType, data, at: new Date().toISOString() });
      }
    } catch (err) {
      if (stopped) return;
      log(`[STREAM] ошибка: ${err.message}, переподключение через 1 сек`);
      setTimeout(watch, 1000);
    }
  }

  watch();
  info('Change Stream запущен');

  return {
    async close() {
      stopped = true;
      if (stream) await stream.close();
      wss.close();
    }
  };
}

module.exports = startStream;
