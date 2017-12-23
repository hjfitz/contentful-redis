import chalk from "chalk";
export default (prefix) => (msg) => {
    console.log(`${chalk.yellow(prefix)} ${msg}`);
};
//# sourceMappingURL=logger.js.map