# Лабораторная работа № 20

Исследование методов управления маршрутами с использованием объекта HTTP Request.
Клубович Михаил, группа 401, вариант 8.

## Запуск

```bash
npm install
node http-server.js
node headers-server.js
node body-server.js
node router-server.js
node http-advanced.js
```

Все серверы слушают порт 3000 (можно поменять через переменную `PORT`), HTTPS в задании 5 — порт 3443 (`HTTPS_PORT`).
Используются только встроенные модули `http`, `https`, `fs`, `url`, `crypto`; пакет `selfsigned` нужен только для генерации самоподписанного сертификата (openssl на Windows может отсутствовать).

## Задания

| Файл | Задание | Что делает |
|------|---------|------------|
| http-server.js | HTTP-сервер на модуле http | `GET /`, `GET /about`, 404 для остальных путей, лог запросов с временем и статусом |
| headers-server.js | Работа с заголовками | `GET /headers`, `GET /headers/set`, `GET /headers/check`; `setHeader`, `getHeader`, `hasHeader`, `removeHeader` |
| body-server.js | Чтение тела запроса | `POST /echo` (json, form, text, octet-stream), `POST /form`, лимит 1 МБ и ответ 413 |
| router-server.js | Маршрутизация по url и method | Таблица маршрутов, параметры пути, query-параметры, REST API `/api/students`, 404 и 405 |
| http-advanced.js | Middleware, статика, кэш, HTTPS | Цепочка middleware, `/static/*` из `public/` с ETag и 304, защита от `../`, кэш `/api/notes` на 60 с, HTTPS, `/stream`, `/metrics`, `access.log`, завершение по Ctrl+C |
| gen-large.js | Вспомогательный | Создает `large-file.json` (2 МБ) для проверки ошибки 413 |

## Примеры проверки

```bash
curl -H "User-Agent: MyAgent/1.0" http://localhost:3000/headers
curl -I http://localhost:3000/headers/set

curl -X POST http://localhost:3000/echo -H "Content-Type: application/json" -d '{"message": "Hello"}'
curl -X POST http://localhost:3000/form -d "name=Ivan&group=401"
node gen-large.js
curl -X POST http://localhost:3000/echo -H "Content-Type: application/json" -d @large-file.json

curl "http://localhost:3000/api/students?group=401"
curl -X PATCH http://localhost:3000/api/students/1

curl -I http://localhost:3000/static/style.css
curl -I http://localhost:3000/static/style.css -H 'If-None-Match: "<etag из прошлого ответа>"'
curl --path-as-is http://localhost:3000/static/../secret.txt
curl -i http://localhost:3000/api/notes
curl http://localhost:3000/stream > big-file.bin
curl -k https://localhost:3443/
curl http://localhost:3000/metrics
```

`--path-as-is` нужен, потому что curl сам убирает `../` из адреса.
При первом запуске `http-advanced.js` создает `certs/` (сертификат) и `data/big-file.bin` (100 МБ) — они в `.gitignore`.
