const { CliError, formatError, handleFatal } = require('../../utils/errors');

const err = new CliError('файл конфигурации не найден', {
  hint: 'Укажите путь через --config',
  details: 'config.json отсутствует в корне проекта',
  short: 'файл config.json не найден',
  cause: new Error("ENOENT: no such file or directory, open 'config.json'")
});

test('formatError в production выводит коротко', () => {
  expect(formatError(err, 'production')).toBe('✖ Ошибка: файл config.json не найден');
});

test('formatError в development выводит стектрейс', () => {
  const text = formatError(err, 'development');
  expect(text).toContain('ENOENT');
  expect(text).toMatch(/\n\s+at /);
});

test('formatError по умолчанию выводит подсказку', () => {
  const text = formatError(err, undefined);
  expect(text).toContain('Укажите путь через --config');
  expect(text).toContain('Подробности:');
  expect(text).not.toMatch(/\n\s+at /);
});

test('handleFatal завершает процесс с кодом 1', () => {
  const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
  const write = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

  handleFatal(new Error('что-то сломалось'));

  expect(exit).toHaveBeenCalledWith(1);
  expect(write.mock.calls[0][0]).toContain('что-то сломалось');
  exit.mockRestore();
  write.mockRestore();
});
