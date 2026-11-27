const fs = require('fs');
const os = require('os');
const path = require('path');
const { createProject, validate } = require('../../services/project');
const { getUrl, deploy } = require('../../services/deploy');
const { build } = require('../../services/build');
const { parseTap } = require('../../services/tester');

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lab17-project-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('createProject создаёт структуру проекта', () => {
  const { root, files } = createProject({ name: 'my-app', type: 'web', dir: tmp });
  expect(files).toContain('config.json');
  expect(fs.existsSync(path.join(root, 'src', 'index.js'))).toBe(true);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  expect(pkg.name).toBe('my-app');
});

test('createProject не перезаписывает существующий каталог', () => {
  createProject({ name: 'twice', dir: tmp });
  expect(() => createProject({ name: 'twice', dir: tmp })).toThrow(/уже существует/);
});

test('validate отклоняет плохие имя и тип', () => {
  expect(() => validate('', 'cli')).toThrow(/не указано/);
  expect(() => validate('плохое имя', 'cli')).toThrow(/недопустимое/);
  expect(() => validate('ok', 'desktop')).toThrow(/неизвестный тип/);
});

test('getUrl для разных окружений', () => {
  expect(getUrl('my-app', 'production')).toBe('https://my-app.example.com');
  expect(getUrl('my-app', 'staging')).toBe('https://my-app.staging.example.com');
});

test('deploy без сборки падает', () => {
  const { root } = createProject({ name: 'nodist', dir: tmp });
  expect(() => deploy({ dir: root, env: 'staging' })).toThrow(/не собран/);
});

test('deploy после build пишет deploy.json', () => {
  const { root } = createProject({ name: 'ready', dir: tmp });
  build({ dir: root });
  const record = deploy({ dir: root, env: 'production' });
  expect(record.url).toBe('https://ready.example.com');
  expect(fs.existsSync(path.join(root, 'deploy.json'))).toBe(true);
});

test('parseTap вытаскивает количество тестов и покрытие', () => {
  const tap = ['# tests 15', '# pass 15', '# fail 0', '# all files | 87.50 | 100.00 | 80.00 |'].join('\n');
  expect(parseTap(tap)).toEqual({ total: 15, passed: 15, failed: 0, coverage: 87.5 });
});
