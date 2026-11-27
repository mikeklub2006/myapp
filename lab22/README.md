# Лабораторная работа № 22

Исследование методов подключения к серверу MySQL и работы с БД.
Клубович Михаил, группа 401, вариант 8.

## Подготовка

Нужен запущенный сервер MySQL на `localhost:3306`. Проверялось на MariaDB 10.4 из XAMPP
(MySQL-совместимый сервер, драйвер `mysql2` работает с ним так же).

1. Под root создать базы и пользователя `student`:

```bash
mysql -u root -p < sql/setup.sql
```

2. Скопировать `.env.example` в `.env` и вписать пароль (в `setup.sql` пароль по умолчанию `student401`):

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=student
DB_PASSWORD=...
DB_NAME=group_401
API_DB_NAME=group_401_api
PORT=3000
```

3. Установить зависимости:

```bash
npm install
```

## Запуск

```bash
node mysql-connect.js
node mysql-crud.js
node mysql-errors.js
node mysql-dao.js

npm run migrate
npm run seed
npm start
```

## Задания

| Файл | Задание | Что делает |
|------|---------|------------|
| mysql-connect.js | Подключение к MySQL | `createConnection` и `createPool` (10 соединений), версия, текущая БД, пользователь, ошибки `ER_ACCESS_DENIED_ERROR` и `ECONNREFUSED` |
| mysql-crud.js | CRUD | Таблица `students`, INSERT (insertId, affectedRows), SELECT с фильтром, сортировкой и LIMIT/OFFSET, UPDATE (affectedRows/changedRows), DELETE, SQL-инъекция при конкатенации и защита плейсхолдерами |
| mysql-errors.js | Ошибки, stream, транзакции | Категории ошибок MySQL, слушатель `error` на пуле с логом в `pool-errors.log` и пересозданием пула, 100 000 строк в `big_data` и чтение через `.stream()`, сравнение памяти с обычным SELECT, commit и rollback |
| StudentDAO.js, mysql-dao.js | DAO | Класс `StudentDAO`: create/findById/findAll/update/delete/search/getStats, валидация, пагинация, фильтры, сортировка, статистика |
| api/ | REST API на Koa | Структура config/models/services/controllers/middleware/migrations/routes, транзакции, кэш, миграции, метрики |

Вместо ББМО-01-23 используется группа 401, поэтому формат `group_name` проверяется как три цифры (`401`, `402`, ...).
База данных называется `group_401` (для API отдельная `group_401_api`).

## Сравнение памяти в mysql-errors.js

Замер делается в дочерних процессах с `--expose-gc`. Чтение через `.stream()` запускается с кучей 24 МБ и проходит,
обычный `SELECT * FROM big_data` занимает около 27 МБ и с тем же ограничением падает с `JavaScript heap out of memory`.

## REST API (api/)

```
GET    /api/students?limit=10&offset=0   список с пагинацией
GET    /api/students/:id                 один студент
POST   /api/students                     создание
PUT    /api/students/:id                 обновление
DELETE /api/students/:id                 удаление
GET    /api/students/stats               статистика
POST   /api/students/batch               массовое создание в транзакции
GET    /api/groups                       список групп
POST   /api/groups                       создание группы
GET    /api/groups/:id/students          студенты группы
GET    /api/cache/stats                  статистика кэша
GET    /api/metrics                      метрики БД
```

- `middleware/db.js` кладет пул в `ctx.db`, взятые соединения возвращаются в пул после запроса.
- Кэш GET-запросов в памяти, TTL 60 секунд, сбрасывается при POST/PUT/DELETE, заголовок `X-Cache: HIT/MISS`.
- Миграции `001_create_students.sql`, `002_create_groups.sql`, таблица `migrations`, `npm run migrate` и `npm run migrate:rollback`.
- Все SQL-запросы логируются в консоль и в `api/logs/sql.log`.
- Ошибки: `ER_DUP_ENTRY` → 409, `ER_NO_REFERENCED_ROW` → 400, `ECONNREFUSED` → 503, ошибки валидации → 400, тело больше 100 КБ → 413.
- `group_name` студента ссылается на таблицу групп внешним ключом, поэтому batch с несуществующей группой откатывается целиком.

Примеры:

```bash
curl "http://localhost:3000/api/students?limit=3"

curl -X POST http://localhost:3000/api/students/batch -H "Content-Type: application/json" \
  -d '[{"name": "Anna", "group_name": "401", "course": 2, "grade": 4.7}, {"name": "Oleg", "group_name": "401", "course": 2, "grade": 3.9}]'

# откат: вторая запись ссылается на несуществующую группу
curl -X POST http://localhost:3000/api/students/batch -H "Content-Type: application/json" \
  -d '[{"name": "Ira", "group_name": "401", "course": 2}, {"name": "Gosha", "group_name": "999", "course": 2}]'

curl http://localhost:3000/api/students/stats
curl http://localhost:3000/api/metrics
curl http://localhost:3000/api/cache/stats
```

В консоли Windows кириллица в `-d` может уйти не в UTF-8, тогда JSON лучше передавать из файла: `--data-binary @student.json`.
