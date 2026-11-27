const chalk = require('chalk');

class CliError extends Error {
  constructor(message, extra = {}) {
    super(message);
    this.name = 'CliError';
    this.hint = extra.hint;
    this.details = extra.details;
    this.short = extra.short;
    this.cause = extra.cause;
    this.exitCode = extra.exitCode || 1;
  }
}

function formatError(err, env = process.env.NODE_ENV) {
  const lines = [];

  if (env === 'development') {
    const source = err.cause || err;
    lines.push(`✖ Ошибка: ${source.message}`);
    const stack = (source.stack || '').split('\n').slice(1);
    lines.push(...stack);
    return lines.join('\n');
  }

  if (env === 'production') {
    lines.push(`✖ Ошибка: ${err.short || err.message}`);
    return lines.join('\n');
  }

  lines.push(`✖ Ошибка: ${err.message}`);
  if (err instanceof CliError) {
    if (err.hint) lines.push(`  ${err.hint}`);
    if (err.details) lines.push(`  Подробности: ${err.details}`);
  } else {
    lines.push('  Для подробностей запустите с NODE_ENV=development');
  }
  return lines.join('\n');
}

function handleFatal(err) {
  if (!(err instanceof Error)) err = new Error(String(err));
  process.stderr.write(chalk.red(formatError(err)) + '\n');
  process.exit(err.exitCode || 1);
}

module.exports = { CliError, formatError, handleFatal };
