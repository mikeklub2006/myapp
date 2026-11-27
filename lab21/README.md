# Лабораторная работа № 21

Исследование методов работы с потоками в Node.js.
Клубович Михаил, группа 401, вариант 8.

## Запуск

```bash
node stream-readable.js
node stream-writable.js
node stream-pipe.js
node stream-transform.js
node stream-pipeline.js
```

Сторонние пакеты не нужны, используются только модули `stream`, `stream/promises` и `fs` (Node.js 16+).

## Задания

| Файл | Задание | Что делает |
|------|---------|------------|
| stream-readable.js | Readable-поток | Свой `Readable` с `_read()`, отдает 4 чанка с данными о группе, чтение через `data`/`end`/`error` |
| stream-writable.js | Writable-поток и backpressure | `_write()` с задержкой, `highWaterMark: 16`, показ `write() = false`, события `drain` и `finish` |
| stream-pipe.js | pipe() и pipeline() | Копирование `input.txt`, ошибка с `missing.txt` (pipe не закрывает приемник, pipeline закрывает все), цепочка uppercase → reverse → `output-chain.txt` |
| stream-transform.js | Transform и Object Mode | `UpperCaseTransform` (префикс `[401]`), `JsonParserTransform`, `FilterTransform`, `for await` против `pipe()`, цепочка из 10 строк |
| stream-pipeline.js | Конвейер обработки | 10 000 студентов (seed = 401) порциями по 100, Validate → Enrich → Filter (grade > 3) → Format → `students.csv`, прогресс-бар, backpressure, `errors.log`, отмена по таймауту через `AbortController`, сравнение с `for await` |

Вместо группы ББМО-01-23 из примеров везде используется группа 401.
Файлы `output-*.txt`, `students*.csv`, `errors.log` создаются при запуске и в репозиторий не добавляются.
