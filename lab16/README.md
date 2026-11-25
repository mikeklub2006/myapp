# Лабораторная работа № 16

Создание простого сервера с использованием фреймворка Express.js.
Клубович Михаил, группа 401, вариант 8.

## Запуск

```bash
npm install
node task1.js
node task2.js
node task3.js
node task4.js
node task5/server.js
```

Все задания работают на порту 3000 (переменная `PORT`), запускать по одному.

## Задания

| Файл | Задание | Что делает |
|------|---------|------------|
| task1.js | Простой HTTP-сервер | HTML-страницы `/`, `/about`, `/contacts`, на главной список маршрутов, дата и время |
| task2.js | HTTP-методы и маршруты | CRUD книг `/api/books`, поиск `/api/books/search?author=`, ошибки 404 и 400 |
| task3.js | Middleware | Логгер `[дата] METHOD /path статус - Nms`, сжатие gzip/deflate, ограничение 100 запросов в минуту (429), обработчик ошибок, `/error` и `/async-error` |
| task4.js | Параметры URL и query | Фильтры `author`, `year`, `yearFrom/yearTo`, пагинация `limit/page`, сортировка `sort=title/-year`, поиск `search`, `/api/books/stats`, проверка дубликатов, лог операций в `operations.log` |
| task5/ | Полное REST API | 100 книг с зерном 401, JWT, роли, отзывы, экспорт/импорт CSV, рекомендации, Swagger, Joi, кэш |

## Задание 5

| Файл | Что внутри |
|------|------------|
| task5/server.js | Подключение роутеров, Swagger, обработка ошибок |
| task5/data.js | Генерация 100 книг (ISBN `978-5-401-...`), хранилище, админ по умолчанию |
| task5/auth.js | `/auth/register`, `/auth/login`, проверка JWT и ролей |
| task5/books.js | Маршруты `/api/books` |
| task5/admin.js | Маршруты `/api/admin` (пользователи, смена роли, статистика) |
| task5/validation.js | Схемы Joi, проверка ISBN-10/ISBN-13, года и жанра |
| task5/cache.js | In-memory кэш GET-запросов на 5 минут, заголовок `X-Cache` |
| task5/swagger.js | Описание API для `/api-docs`, схемы тел запросов берутся из Joi |

Администратор создается при запуске: `admin@library.local` / `admin401` (можно поменять через `ADMIN_EMAIL` и `ADMIN_PASSWORD`).
Обычный пользователь регистрируется через `/auth/register`.

Права:
- все `/api/books` - только с токеном;
- `POST /api/books`, `DELETE /api/books/:id`, `POST /api/books/import`, все `/api/admin` - только admin.

Документация: http://localhost:3000/api-docs

## Примеры запросов

```bash
curl -X POST -H "Content-Type: application/json" -d '{"email":"admin@library.local","password":"admin401"}' http://localhost:3000/auth/login
curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/books?yearFrom=2000&sort=-year&limit=5&page=1"
curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/books/export?format=csv" -o books.csv
curl -H "Authorization: Bearer <token>" -F "file=@books.csv" http://localhost:3000/api/books/import
```
