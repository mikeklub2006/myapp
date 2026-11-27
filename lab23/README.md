# Лабораторная работа № 23

Исследование методов работы с MongoDB средствами Node.js.
Клубович Михаил, группа 401, вариант 8.

## Подготовка

```bash
npm install
cp .env.example .env
npm run mongo
```

На компьютере не установлен MongoDB и Docker, поэтому сервер поднимается через `mongodb-memory-server`
(`mongo-server.js`): настоящий `mongod` 7.0 на порту 27017, реплика-сет `rs0` из одного узла,
включена авторизация, создан пользователь `student` / `password` для базы `bbmo_401`.
При первом запуске скачивается бинарник mongod. Данные хранятся во временной папке и пропадают после остановки.
С обычным MongoDB (`mongod --replSet rs0` + `rs.initiate()`) скрипты тоже работают - нужно только поменять `MONGO_URI` в `.env`.

Сервер должен быть запущен в отдельном терминале, пока выполняются остальные скрипты.

## Запуск

```bash
node mongodb-connect.js          # задание 1
node mongodb-connect.js --bad    # задание 1, ошибка подключения (неверный пароль)
node mongodb-crud.js             # задание 2
node mongodb-advanced.js         # задание 3 (первый запуск генерирует 1 000 000 документов)
node mongodb-transactions.js     # задание 4
npm start                        # задание 5, Koa на 3000, WebSocket на 3001
npm run ws-client                # задание 5, клиент WebSocket
```

## Задания

| Файл | Задание | Что делает |
|------|---------|------------|
| mongodb-connect.js | Подключение | MongoClient и directConnection, ping, buildInfo, список БД и коллекций, события heartbeat |
| mongodb-crud.js | CRUD | insertOne/insertMany, find с фильтром, сортировкой, пагинацией и проекцией, update ($set, $inc, $unset, $push), delete |
| mongodb-advanced.js | Курсоры, агрегации, индексы | for await с batchSize 1000 по 1 000 000 документов, падение toArray() при нехватке памяти, $group/$lookup, explain() до и после индекса, текстовый поиск |
| mongodb-transactions.js | Транзакции и Change Streams | статус реплика-сета, commit и abort (дубликат email), watch() на students, read preference |
| task5/ | DAO + Koa.js | REST API для students, транзакции, Change Streams + WebSocket, метрики, кэш, валидация |
| mongo-server.js | - | запуск MongoDB через mongodb-memory-server |
| generator.js | - | генерация студентов, ГПСЧ с сидом 401 |

## Задание 5

```
task5/
├── app.js
├── config/mongo.js
├── models/student.js
├── dao/StudentDAO.js
├── services/studentService.js, cache.js
├── controllers/studentController.js
├── middleware/db.js, errors.js, logger.js, metrics.js
├── routes/students.js
├── streams/studentStream.js
└── ws-client.js
```

| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/students?limit=&offset=&sort=-grade&group_name=&course=&grade_min=&grade_max= | список с пагинацией |
| GET | /api/students/:id | один студент |
| POST | /api/students | создание |
| PUT | /api/students/:id | обновление через $set |
| DELETE | /api/students/:id | удаление |
| GET | /api/students/stats | агрегация: всего, средний балл, по группам и курсам |
| GET | /api/students/search?q=Иван | текстовый поиск с textScore |
| POST | /api/students/batch | массовая вставка в транзакции |
| GET | /api/metrics | количество запросов, среднее время, ошибки, кэш |

- При первом запуске коллекция заполняется 1000 студентов (сид 401).
- Валидация: JSON Schema через ajv в приложении и та же схема как `$jsonSchema` валидатор коллекции в MongoDB.
- Кэш GET-запросов в памяти на 60 секунд (заголовок `X-Cache`), сбрасывается при любом изменении и по событиям Change Stream.
- Ошибки: 400 - валидация и неверный id, 404 - не найдено, 409 - дубликат email (в batch транзакция откатывается).

Пример проверки:

```bash
curl "http://localhost:3000/api/students?limit=3"
curl -X POST http://localhost:3000/api/students/batch -H "Content-Type: application/json" \
  -d '[{"name":"Анна Новикова","email":"anna@bbmo.local","group_name":"401","course":2,"grade":4.9},
       {"name":"Олег Орлов","email":"oleg@bbmo.local","group_name":"401","course":3,"grade":4.1}]'
curl http://localhost:3000/api/students/stats
curl "http://localhost:3000/api/students/search?q=Иван"
curl http://localhost:3000/api/metrics
```

## Отличия от методички

- Вместо группы ББМО-01-23 используется 401 (группы 401, 402, 403), база называется `bbmo_401`, формат группы - три цифры.
- MongoDB запускается через mongodb-memory-server, а не установленным сервером.
- В примере методички для дубликата указан код `ER_DUP_ENTRY` (это MySQL), в MongoDB это ошибка `E11000`.
- Чтобы получить `JavaScript heap out of memory`, toArray() выполняется в дочернем процессе с `--max-old-space-size=64`.
