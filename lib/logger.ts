import chalk from "chalk";

export default (prefix: string): Function => (msg: String) => {
  console.log(`${chalk.yellow(prefix)} ${msg}`);
};


