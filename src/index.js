const contentful = require('contentful');
const redis = require('redis');
const redisHelper = require('../redis-promise-wrapper');

const ContentfulRedisError = require('./wrapper-error');

class ContentfulRedisWrapper {
  constructor(ContentfulRedisOptions) {
    // check to see if we are given arguments

    // check for missing options
    this.requiredArgs = ['space', 'accessToken'];
    this.missingArgs = this.requiredArgs.filter(arg => (!(arg in ContentfulRedisOptions)));

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

    // then, redis
    this.setKey = redisHelper.setKey.bind(this);
    this.getByKey = redisHelper.getByKey.bind(this);
    this.getKeys = redisHelper.getKeys.bind(this);
    this.delKey = redisHelper.delKey.bind(this);
    this.delKeys = redisHelper.delKeys.bind(this);

    // make sure to init() before doing anything else
    Promise.resolve(this.snyc());
  }

  // if it's the initial sync, don't bother with getting the token
  // else, use that token
  async sync() {
    let resp;
    if (this.initialSync) {
      resp = await this.sync({ initial: this.initialSync });
    } else {
      const nextSyncToken = await this.getByKey('contentful:syncToken');
      resp = await this.sync({ nextSyncToken });
      this.setKey('contentfulSyncToken', resp.nextSyncToken);
    }
    const deletedItems = resp.deletedEntries;
    const newItems = resp.entries;
    // delete the everything old from the response
    const keysToDelete = deletedItems.map(del => del.sys.id).map(this.formatKey);
    Promise.all(this.delKeys(keysToDelete));
    // format and store the (new) results

    // handle any links/references
  }

  static formatKey(entry) {
    const id = entry.sys.id;
    // todo: figure out how to store content type
    return `contentful:entry:${id}`;
  }

  static handleReferences(entry) {
    console.log(entry);
  }
}

module.exports = ContentfulRedisWrapper;
