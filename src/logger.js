const chalk = require('chalk');

const print = (prefix, msg) => {
    return (msg) => {
        // if (process.env.DEBUG === 'true') {
            console.log(`${prefix} ${msg}`);
        // }
    }
}

module.exports = print;