# Лабораторная работа № 15

Создание простого сервера с использованием фреймворка Koa.js.
Клубович Михаил, группа 401, вариант 8.

## Запуск

```bash
npm install
node task1.js
node task2.js
node task3.js
node task4.js
node task5.js
```

Все задания запускаются на порту 3000 (можно поменять через переменную `PORT`), поэтому запускать их нужно по одному.

## Задания

| Файл | Задание | Что делает |
|------|---------|------------|
| task1.js | Простой HTTP-сервер | `GET /` отдает HTML-страницу: заголовок, группа, дата и время, приветствие |
| task2.js | HTTP-методы и маршруты | CRUD пользователей `/api/users`, ошибки 404 и 400 |
| task3.js | Middleware | Логирование `[дата] METHOD /path - Nms`, обработка ошибок в JSON, авторизация по заголовку `Authorization` (`/protected`), тестовый `/error` |
| task4.js | Параметры URL и query | CRUD студентов `/students`, фильтр `?group=`, валидация, курс вычисляется по номеру группы |
| task5.js | Полное REST API | 50 студентов генерируются с зерном 401, пагинация `limit/offset`, сортировка `sort=name/-name/course`, поиск `search`, CRUD с валидацией |

## Примеры запросов

```bash
curl http://localhost:3000/api/users
curl -X POST -H "Content-Type: application/json" -d '{"name":"Сидоров Сидор","group":"401"}' http://localhost:3000/api/users
curl -H "Authorization: Bearer test" http://localhost:3000/protected
curl "http://localhost:3000/students?group=401"
curl "http://localhost:3000/students?limit=5&offset=10&sort=-name"
```
