const contentful = require('contentful');
const redis = require('redis');

const ContentfulRedisError = require('./wrapper-error');

class ContentfulRedisWrapper {
  constructor(ContentfulRedisOptions) {
    // check to see if we are given arguments

    // check for missing options
    this.requiredArgs = ['space', 'accessToken'];
    this.missingArgs = this.requiredArgs.filter(arg => (!(arg in ContentfulRedisOptions)));
    console.log(this.missingArgs);

    // throw an error if we don't have all of the options
    if (this.missingArgs.length > 0) {
      throw new ContentfulRedisError('Missing arguments: ', this.missingArgs.join(' '));
    }

    // setup contentful
    this.contentful = contentful.createClient({
      accessToken: ContentfulRedisOptions.accessToken,
      space: ContentfulRedisOptions.space,
    });

    /*
     * Yhe contentful sync api is used, for less strain
     * This is the constructor, so there's been no sync yet.
     * later on, the nextSyncToken is stored here.
     */
    this.initialSync = true;

    // setup redis
    this.redisOpts = {
      host: ContentfulRedisOptions.host || '127.0.0.1',
      port: ContentfulRedisOptions.port || 6379,
    };

    // create a connection to redis
    // this.store = redis.createClient(this.redisOpts);

    // bind functions we'll use to this class
    // firstly, contentful
    this.sync = this.contentful.sync.bind(this);

    Promise.resolve(this.init());
  }

  async init() {
    const resp = await (this.sync({ initial: this.initialSync }));
    this.initialSync = false;
    this.nextSyncToken = await resp.nextSyncToken;
    console.log(resp);
  }
}

module.exports = ContentfulRedisWrapper;
