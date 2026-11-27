const chalk = require('chalk');
const ora = require('ora');
const readline = require('readline');

function success(text) {
  process.stderr.write(chalk.green(`✔ ${text}`) + '\n');
}

function warn(text) {
  process.stderr.write(chalk.yellow(`⚠ ${text}`) + '\n');
}

function info(text) {
  process.stderr.write(chalk.blue(text) + '\n');
}

// данные (результаты) идут в stdout, всё остальное в stderr
function result(text) {
  process.stdout.write(text + '\n');
}

function spinner(text) {
  return ora({ text, stream: process.stderr }).start();
}

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    let answered = false;
    rl.question(`${question} (y/N) `, (answer) => {
      answered = true;
      rl.close();
      resolve(/^(y|yes|д|да)$/i.test(answer.trim()));
    });
    rl.on('close', () => {
      if (!answered) {
        process.stderr.write('\n');
        resolve(false);
      }
    });
  });
}

module.exports = { success, warn, info, result, spinner, formatDuration, confirm };
