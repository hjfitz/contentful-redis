const chalk = require('chalk');

const print = prefix => msg => {
  console.log(`${chalk.yellow(prefix)} ${msg}`);
};

module.exports = print;
