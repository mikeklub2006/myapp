const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { CliError } = require('../utils/errors');

const GROUP = '401';
const TYPES = ['cli', 'web', 'lib', 'service'];

function validate(name, type) {
  if (!name) {
    throw new CliError('не указано название проекта', { hint: 'Используйте --name <имя>', short: 'нет --name' });
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) {
    throw new CliError(`недопустимое название "${name}"`, {
      hint: 'Допустимы латинские буквы, цифры, точка, дефис и подчёркивание'
    });
  }
  if (!TYPES.includes(type)) {
    throw new CliError(`неизвестный тип проекта "${type}"`, { hint: `Допустимые типы: ${TYPES.join(', ')}` });
  }
}

function projectFiles(name, type) {
  const pkg = {
    name,
    version: '1.0.0',
    description: `Проект типа ${type} (группа ${GROUP})`,
    main: 'src/index.js',
    scripts: { test: 'node --test' },
    license: 'ISC'
  };
  const config = { name, type, group: GROUP, entry: 'src/index.js', outDir: 'dist' };

  const source = [
    'function sum(a, b) {',
    '  return a + b;',
    '}',
    '',
    'function greet(name) {',
    `  return \`Привет, \${name}! Группа ${GROUP}\`;`,
    '}',
    '',
    'module.exports = { sum, greet };',
    ''
  ].join('\n');

  const test = [
    "const test = require('node:test');",
    "const assert = require('node:assert');",
    "const { sum, greet } = require('../src/index');",
    '',
    "test('sum складывает числа', () => {",
    '  assert.strictEqual(sum(2, 3), 5);',
    '});',
    '',
    "test('sum с отрицательными', () => {",
    '  assert.strictEqual(sum(-1, 1), 0);',
    '});',
    '',
    "test('greet возвращает приветствие', () => {",
    `  assert.ok(greet('Иван').includes('${GROUP}'));`,
    '});',
    ''
  ].join('\n');

  return {
    'package.json': JSON.stringify(pkg, null, 2) + '\n',
    'config.json': JSON.stringify(config, null, 2) + '\n',
    'src/index.js': source,
    'tests/index.test.js': test,
    '.gitignore': 'node_modules/\ndist/\n'
  };
}

function createProject({ name, type = 'cli', dir = process.cwd() }) {
  validate(name, type);
  const root = path.join(dir, name);
  if (fs.existsSync(root)) {
    throw new CliError(`каталог "${name}" уже существует`, { hint: 'Выберите другое название', short: `${name} уже существует` });
  }

  const files = projectFiles(name, type);
  for (const [file, content] of Object.entries(files)) {
    const full = path.join(root, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return { root, files: Object.keys(files) };
}

function installDependencies(root) {
  // на windows npm - это npm.cmd, поэтому через shell
  const res = spawnSync('npm install --no-audit --no-fund --silent', {
    cwd: root,
    shell: true,
    encoding: 'utf8'
  });
  return res.status === 0;
}

function initGit(root) {
  const res = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8' });
  return res.status === 0;
}

module.exports = { TYPES, validate, projectFiles, createProject, installDependencies, initGit };
