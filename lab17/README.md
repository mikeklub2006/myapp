# Лабораторная работа № 17

Исследование методов создания CLI-приложений.
Клубович Михаил, группа 401, вариант 8.

## Установка

```bash
cd lab17
npm install
cd task5
npm install
```

## Запуск

```bash
# задание 1
node task1.js
node task1.js greet "Иван"
node task1.js info
node task1.js unknown        # код возврата 1 (echo $? / echo %ERRORLEVEL%)

# задание 2
node task2.js --help
node task2.js generate --help
node task2.js generate --type pdf --output report.pdf --verbose
node task2.js generate --type html --dry-run
node task2.js generate --type unknown
node task2.js generate -t json -o report.json
node task2.js convert -i report.json
node task2.js --version

# задание 3
node task3.js init
node task3.js init --name my-project --type cli --typescript --prettier --git
node task3.js init --no-interactive
echo "my-project" | node task3.js init --no-interactive

# задание 4
node task4.js samples                          # создает samples/file1..10.txt
node task4.js process --files samples/file1.txt samples/file2.txt samples/file3.txt
node task4.js process --files "samples/*.txt"
node task4.js process --files samples/file1.txt missing.txt
node task4.js process --files samples/file1.txt > result.json
```

Задание 5 (из папки `task5`):

```bash
npm link                     # команда my-cli становится доступна глобально
my-cli init --name my-app --type cli
cd my-app
my-cli build
my-cli test
my-cli deploy --env production
NODE_ENV=development my-cli build --config nope.json
NODE_ENV=production my-cli build --config nope.json

npm test                     # jest: юнит и интеграционные тесты
npm run build:exe            # бинарник dist/my-cli.exe (@yao-pkg/pkg)
```

## Задания

| Файл | Задание | Что делает |
|------|---------|------------|
| task1.js | Простое CLI-приложение | Разбор `process.argv`, команды `greet` и `info`, справка без аргументов, код возврата 1 при ошибке |
| task2.js | Опции и флаги (commander) | Подкоманды `generate` и `convert`, короткие/длинные опции, `--dry-run`, `--force`, `--verbose`, `--version`, валидация типа |
| task3.js | Интерактивный режим (inquirer) | Команда `init`: вопросы input/list/checkbox/confirm/password, режим флагов, `--no-interactive`, чтение имени из stdin |
| task4.js | Форматированный вывод | chalk, ora, cli-progress; данные в stdout, логи в stderr, без цветов и лишнего вывода при перенаправлении |
| task5/ | Полноценное приложение | `bin/`, `commands/`, `services/`, `utils/`, обработка `uncaughtException`/`unhandledRejection`, NODE_ENV, тесты jest, сборка через pkg |

## Структура task5

```
task5/
  bin/my-cli.js          точка входа, commander только маппит флаги
  commands/              init.js, build.js, test.js, deploy.js
  services/              config.js, project.js, build.js, tester.js, deploy.js
  utils/                 errors.js (CliError, вывод ошибок), output.js (цвета, спиннеры, подтверждение)
  tests/services/        юнит-тесты сервисов
  tests/utils/           тесты обработчика ошибок (перехват process.exit)
  tests/integration/     запуск CLI через child_process.spawn
```

`my-cli test` запускает тесты созданного проекта через `node --test` с покрытием, поэтому для этой команды нужен Node.js 20+ в PATH.
Остальные команды бинарника работают без установленного Node.js. Бинарник в репозиторий не добавляется (`task5/dist/` в `.gitignore`).

В PowerShell переменная окружения задается так: `$env:NODE_ENV="production"; my-cli build`.
