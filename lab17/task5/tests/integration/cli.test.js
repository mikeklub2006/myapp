const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const BIN = path.join(__dirname, '..', '..', 'bin', 'my-cli.js');
const pkg = require('../../package.json');

function run(args, { cwd, env = {}, input } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd,
      // без цветов, иначе escape-коды мешают проверять вывод
      env: { ...process.env, NODE_ENV: '', FORCE_COLOR: '0', ...env }
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    if (input !== undefined) child.stdin.write(input);
    child.stdin.end();
  });
}

let tmp;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lab17-cli-'));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('--help выводит справку', async () => {
  const res = await run(['--help']);
  expect(res.code).toBe(0);
  expect(res.stdout).toContain('Usage: my-cli');
  expect(res.stdout).toContain('deploy');
});

test('--version выводит версию', async () => {
  const res = await run(['--version']);
  expect(res.code).toBe(0);
  expect(res.stdout.trim()).toBe(pkg.version);
});

test('неизвестная команда возвращает код 1', async () => {
  const res = await run(['unknown']);
  expect(res.code).toBe(1);
  expect(res.stderr).toContain('unknown command');
});

test('build без config.json: код 1 и без стектрейса', async () => {
  const res = await run(['build'], { cwd: tmp, env: { NODE_ENV: 'production' } });
  expect(res.code).toBe(1);
  expect(res.stderr).toContain('файл config.json не найден');
  expect(res.stderr).not.toMatch(/\n\s+at /);
});

test('в development выводится стектрейс', async () => {
  const res = await run(['build'], { cwd: tmp, env: { NODE_ENV: 'development' } });
  expect(res.code).toBe(1);
  expect(res.stderr).toContain('ENOENT');
  expect(res.stderr).toMatch(/\n\s+at /);
});

test('init создаёт проект, build с --dry-run не изменяет файлы', async () => {
  const init = await run(['init', '--name', 'cli-app', '--no-install', '--no-git'], { cwd: tmp });
  expect(init.code).toBe(0);
  expect(init.stderr).toContain('Проект "cli-app" создан');

  const root = path.join(tmp, 'cli-app');
  const before = fs.readdirSync(root).sort();
  const res = await run(['build', '--dry-run'], { cwd: root });
  expect(res.code).toBe(0);
  expect(fs.readdirSync(root).sort()).toEqual(before);
});

test('deploy в production без подтверждения отменяется', async () => {
  const root = path.join(tmp, 'cli-app');
  await run(['build'], { cwd: root });
  const res = await run(['deploy', '--env', 'production'], { cwd: root, input: 'n\n' });
  expect(res.code).toBe(1);
  expect(res.stderr).toContain('отменено');
  expect(fs.existsSync(path.join(root, 'deploy.json'))).toBe(false);
});

test('deploy --force разворачивает без вопросов', async () => {
  const root = path.join(tmp, 'cli-app');
  const res = await run(['deploy', '--env', 'production', '--force'], { cwd: root });
  expect(res.code).toBe(0);
  expect(res.stdout).toContain('URL: https://cli-app.example.com');
});
