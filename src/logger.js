const chalk = require('chalk');

const print = (prefix, msg) => msg => {
  // console.log(`${chalk.yellow(prefix)} ${msg}`);
};

module.exports = print;
