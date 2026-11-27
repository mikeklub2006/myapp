# Лабораторная работа № 24

REST API для работы с пользователями на MongoDB и Koa.js.
Клубович Михаил, группа 401, вариант 8.

## Запуск

Задания 1-4 используют общий `package.json`:

```bash
cd lab24
npm install
cp .env.example .env     # нужен для задания 4 (секреты JWT)
npm run start:task1      # или start:task2, start:task3, start:task4
```

Задание 5 - отдельный проект:

```bash
cd lab24/task5
npm install
npm start                # http://localhost:3000, Swagger: /api-docs
npm test
npm run test:coverage
npm run lint
node scripts/ws-client.js ws://localhost:3000/ws
```

MongoDB на компьютере не установлена, поэтому если в `.env` не задан `MONGO_URI`,
приложение само поднимает временную MongoDB в памяти через `mongodb-memory-server`
(при первом запуске скачивается бинарник mongod). С реальным сервером достаточно указать `MONGO_URI`.

## Задания

| Папка | Задание | Что сделано |
|-------|---------|-------------|
| task1 | Простой REST API | `app.js`, `db.js`, `routes/users.js`, `controllers/users.js`, `models/user.js`; CRUD `/api/users`, ручная валидация, коды 400/404/409/500, заголовок `X-Group: 401` |
| task2 | MVC | класс `User` со статическими методами, `services/userService.js` (уникальность email, bcrypt, имитация письма, лог), контроллер, middleware db/error/logger/validation, схемы Joi |
| task3 | Пагинация, фильтры, сортировка | `?page&limit` (до 100), фильтры `group_name`, `course`, `age_min/age_max`, `sort=-age`, текстовый индекс и `?search`, `/search`, `/stats` (агрегация `$facet`), `/export` в CSV, Joi-схема для query |
| task4 | Аутентификация и безопасность | `/api/auth/register`, `login`, `refresh`, `logout`, JWT HS256 (access 15 мин, refresh 7 дней, хранится и отзывается в `refresh_tokens`), bcrypt 10 раундов, роли user/moderator/admin, `requireRole`, `/api/admin/users`, helmet, CORS по белому списку, rate limit 100 запросов/мин, защита от NoSQL-инъекций, лог попыток входа в консоль и `task4/logs/auth.log` |
| task5 | Production-ready API | см. ниже |

### Задание 5

| Путь | Содержимое |
|------|------------|
| `src/` | приложение: `app.js`, `server.js`, модели, сервисы, контроллеры (с JSDoc для Swagger), middleware, `ws.js`, `metrics.js` |
| `tests/` | `unit/` (сервисы с моками), `integration/` (API через supertest), `e2e/` (полный цикл по HTTP и WebSocket) |
| `docs/` | `openapi.json`, генерируется `npm run docs` |
| `migrations/` | валидатор коллекции `users` (JSON Schema), индексы, TTL для refresh-токенов |
| `scripts/` | `migrate.js`, `seed.js`, `generate-docs.js`, `ws-client.js` |
| `docker/` | `Dockerfile` (multi-stage, node:20-alpine), `docker-compose.yml` с MongoDB |
| `../../.github/workflows/lab24-ci.yml` | lint, тесты, проверка покрытия, сборка образа, push в ghcr.io, имитация деплоя на staging |

Эндпоинты: `/health`, `/ready`, `/metrics` (Prometheus), `/api-docs` (Swagger UI), `/api/auth/*`,
`/api/users` (CRUD, `search`, `stats`, `export?format=csv|json`, `import`, `/:id/avatar`),
`/api/admin/users` (с удаленными, восстановление, смена роли). Удаление мягкое - ставится `deleted_at`.
WebSocket `/ws` рассылает события `user.created`, `user.updated`, `user.deleted` и др.
Логи пишутся в JSON через pino, письма отправляются через nodemailer (без `SMTP_URL` - `jsonTransport`).
HTTPS включается, если заданы `SSL_KEY_PATH` и `SSL_CERT_PATH`.

Docker:

```bash
cd lab24/task5
docker compose -f docker/docker-compose.yml up --build
```

## Отличия от методички

- Группа студента - `401`, поэтому формат `group_name` - три цифры (`/^\d{3}$/`) вместо `ББМО-XX-XX`, тестовые группы 401, 402, 403; база `bbmo_401`.
- Тестовые пользователи генерируются детерминированно, зерно генератора - номер группы 401.
- Вместо нативного `bcrypt` используется `bcryptjs` (тот же алгоритм, 10 раундов, не нужна сборка под Windows).
- `swagger-ui-express` работает только с Express, для Koa взят аналог `koa2-swagger-ui`, спецификацию строит `swagger-jsdoc`.
- Docker на этом компьютере не установлен, `Dockerfile` и `docker-compose.yml` написаны, но локально не запускались.
- Workflow лежит в корне репозитория (`.github/workflows`), иначе GitHub Actions его не увидит.
