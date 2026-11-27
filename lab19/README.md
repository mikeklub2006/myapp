# Лабораторная работа № 19

Исследование методов работы модуля Events.
Клубович Михаил, группа 401, вариант 8.

## Запуск

```bash
node events-basic.js
node events-once.js
node events-class.js
node events-class.js crash
node events-advanced.js
node event-bus.js
```

`event-bus.js` после демонстрации запускает HTTP-сервер на порту 3000:

```bash
curl http://localhost:3000/metrics
curl http://localhost:3000/system
```

Остановка сервера — Ctrl+C.

## Задания

| Файл | Задание | Что делает |
|------|---------|------------|
| events-basic.js | Простой EventEmitter | События `greet`, `info`, `bye`, возвращаемое значение `emit()` |
| events-once.js | on, once, addListener | Сравнение `on`/`once`, `listenerCount`, `listeners`, `removeListener`, `removeAllListeners`, порядок вызова |
| events-class.js | Наследование от EventEmitter | Класс `DatabaseConnection` (connect, query, close, error), обработка `error`; с аргументом `crash` показывает падение процесса без слушателя `error` |
| events-advanced.js | newListener, removeListener | Класс `PluginManager`, демонстрация утечки слушателей, async-слушатели и `setImmediate` |
| event-bus.js | EventBus | Приоритеты, `onAny`, once, метрики, обработка ошибок, интеграция с `os` и `http` (`GET /metrics`, `GET /system`) |

Требования: Node.js 16+, сторонние пакеты не используются.
