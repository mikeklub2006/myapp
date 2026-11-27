const EventEmitter = require('events');

// сервисы публикуют события сюда, а websocket-сервер рассылает их клиентам
const notifier = new EventEmitter();

function publish(event, data) {
  notifier.emit('event', { event, data, time: new Date().toISOString() });
}

module.exports = { notifier, publish };
