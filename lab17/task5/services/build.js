const fs = require('fs');
const path = require('path');
const { readConfig } = require('./config');
const { CliError } = require('../utils/errors');

function planBuild(dir, configPath) {
  const config = readConfig(dir, configPath);
  const entry = path.resolve(dir, config.entry);
  if (!fs.existsSync(entry)) {
    throw new CliError(`точка входа ${config.entry} не найдена`, {
      hint: 'Проверьте поле "entry" в config.json',
      short: `нет файла ${config.entry}`
    });
  }
  const output = path.join(config.outDir, `${config.name}.js`);
  return { config, entry, output, outputPath: path.resolve(dir, output) };
}

function build({ dir = process.cwd(), configPath, dryRun = false } = {}) {
  const started = Date.now();
  const plan = planBuild(dir, configPath);
  const source = fs.readFileSync(plan.entry, 'utf8');
  const banner = `// ${plan.config.name} build ${new Date().toISOString()}\n`;
  const content = banner + source;

  if (!dryRun) {
    fs.mkdirSync(path.dirname(plan.outputPath), { recursive: true });
    fs.writeFileSync(plan.outputPath, content, 'utf8');
  }

  return {
    output: plan.output.split(path.sep).join('/'),
    size: Buffer.byteLength(content),
    dryRun,
    duration: Date.now() - started
  };
}

module.exports = { planBuild, build };
