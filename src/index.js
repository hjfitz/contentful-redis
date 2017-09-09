const contentful = require('contentful');
const redis = require('redis');

class Wrapper {
    construtor(opts) {
        this.space = opts.space;
        this.accessToken = opts.accessToken;
        this.redisUrl = opts.redisUrl || 'localhost';
        this.redisPort = opts.redisPort || 6379;

    }

    getEntry(id) {}

    getEntries(args) {}


}