const fs = require('fs');
const os = require('os');
const path = require('path');
const { build } = require('../../services/build');
const { readConfig } = require('../../services/config');
const { createProject } = require('../../services/project');
const { CliError } = require('../../utils/errors');

let tmp;
let root;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lab17-build-'));
  root = createProject({ name: 'demo', type: 'cli', dir: tmp }).root;
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('readConfig читает config.json проекта', () => {
  const config = readConfig(root);
  expect(config.name).toBe('demo');
  expect(config.group).toBe('401');
  expect(config.outDir).toBe('dist');
});

test('readConfig без файла бросает CliError с подсказкой', () => {
  expect(() => readConfig(tmp)).toThrow(CliError);
  try {
    readConfig(tmp);
  } catch (err) {
    expect(err.hint).toContain('--config');
    expect(err.cause.code).toBe('ENOENT');
  }
});

test('readConfig ругается на битый JSON', () => {
  fs.writeFileSync(path.join(root, 'config.json'), '{ name: ', 'utf8');
  expect(() => readConfig(root)).toThrow(/не удалось разобрать/);
});

test('build создаёт файл в dist', () => {
  const res = build({ dir: root });
  expect(res.output).toBe('dist/demo.js');
  const content = fs.readFileSync(path.join(root, 'dist', 'demo.js'), 'utf8');
  expect(content).toContain('module.exports');
});

test('build с dryRun ничего не пишет', () => {
  const res = build({ dir: root, dryRun: true });
  expect(res.dryRun).toBe(true);
  expect(res.size).toBeGreaterThan(0);
  expect(fs.existsSync(path.join(root, 'dist'))).toBe(false);
});

test('build без точки входа бросает ошибку', () => {
  fs.rmSync(path.join(root, 'src'), { recursive: true });
  expect(() => build({ dir: root })).toThrow(/точка входа/);
});
