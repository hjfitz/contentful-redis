const contentful = require('contentful');
const redis = require('redis');

const redisHelper = require('./redis-promise-wrapper');
const ContentfulRedisError = require('./wrapper-error');
const log = require('./logger')('[CONTENTFUL]');

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
     * The contentful sync api is used, for less strain
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
    this.store = redis.createClient(this.redisOpts);

    // bind functions we'll use to this class
    // firstly, contentful
    this.pureSync = this.contentful.sync.bind(this);

    // then, redis promise wrappers
    this.setKey = redisHelper.setKey.bind(this);
    this.getByKey = redisHelper.getByKey.bind(this);
    this.getKeys = redisHelper.getKeys.bind(this);
    this.delKey = redisHelper.delKey.bind(this);
    this.delKeys = redisHelper.delKeys.bind(this);
    this.handleReferences = this.handleReferences.bind(this);

    // make sure to init() before doing anything else
    Promise.resolve(this.sync());
  }

  // if it's the initial sync, don't bother with getting the token
  // else, use that token
  async sync() {
    this.delKey('contentful:syncToken');
    let resp;
    if (this.initialSync) {
      log('Beginning initial sync in src/index.js@sync()');
      resp = await this.pureSync({ initial: this.initialSync });
      this.initialSync = false;
    } else {
      log('Syncing using token in src/index.js@sync()');
      const nextSyncToken = await this.getByKey('contentfulSyncToken');
      resp = await this.pureSync({ nextSyncToken });
    }
    log('Setting next sync token in src/index.js@sync()');
    this.setKey('contentfulSyncToken', resp.nextSyncToken);
    log('Sync complete');
    const { deletedEntries, entries: newEntries } = await resp;
    // delete the everything old from the response
    if (deletedEntries.length > 0) await this.handleDeletions(deletedEntries);
    // format and store the (new) entries
    if (newEntries.length > 0) await this.handleEntries(newEntries);
  }

  static formatKey(args) {
    const entryID = args.id || args.entry.sys.id;
    // todo: figure out how to store content type
    return `contentful:entry:${entryID}`;
  }

  async handleDeletions(deletedEntries) {
    log(`Formatting ${deletedEntries.length} items for deletion`);
    const keysToDelete = deletedEntries.map(del => del.sys.id).map(this.formatKey);
    log('Attempting to delete items from Redis in src/index.js@handleDeletions()');
    Promise.all(this.delKeys(keysToDelete));
  }

  /**
   * Contentful gives us a load of awesome new stuff to store
   * To save space and ensure that there are no redundant stores
   * (ie Contentful gives us an two entries, one has a link to the other)
   * The link is deleted, and replaced with the key that we know we'll store
   * This is completed by traversing the response down to the fields
   * If we know there's a 'sys' item there, we must handle the reference
   *
   * After the referencing is handled, all of this is stored!
   * @param {Array<Object>} newItems New items to format and store
   */
  handleEntries(newItems) {
    log('Entering in src/index.js@handleEntries()');
    newItems.forEach(item => {
      Object.keys(item.fields).forEach(field => {
        log('Attempting to format by locale in src/index.js@handleEntries()');
        // We make way for locales - to enable users to deliver to different parts of the world
        Object.keys(item.fields[field]).forEach(async locale => {
          const content = item.fields[field][locale];
          // we can be sure that there is a link if the field contains 'sys'
          if (Array.isArray(content) && 'sys' in content[0]) {
            log('Attempting to delete old entries and replace with key reference in src/index.js@handleEntries()');
            // delete the old entry because it's immutable
            const formattedRef = await this.handleReferences(content, true);
            item.fields.contentfulRef = field;
            item.fields.contentfulRef[field] = formattedRef;
            console.log(item.fields[field]);
            log('Formatted entries in src/index.js@handleEntries()');
          }
        });
      });
      // generate a key and store it in the store!
      const key = ContentfulRedisWrapper.formatKey({ id: item.sys.id });
      log(`Attempting to store ${newItems.length} entries in src/index.js@handleEntries()`);
      Promise.resolve(this.setKey(key, item)).then(() => {
        log('Entries stored. src/index.js@handleEntries()');
      }).catch(err => {
        log('Error storing entries. src/index.js@handleEntries()');
        console.error(err);
      });
    });
  }

  /**
   * Handle the references. If we're storing data, format it correctly.
   * Else, get the references from redis
   * @param {Array<Object>} content should be a list of fields
   * @param {Bool} storage Whether we're storing or remaking the data
   */
  async handleReferences(content, storage) {
    if (storage) {
    // first, get the IDs
      const contentIDs = content.map(contentItem => contentItem.sys.id);
      // then, give them a key, letting them know they're a reference
      // and format them, for redis
      const refMap = contentIDs.map(id => ({
        contentfulRef: ContentfulRedisWrapper.formatKey({ id }),
      }));
      return refMap;
    }
    const datastoreKeys = content.map(contentItem => contentItem.contentfulRef);
    const promises = datastoreKeys.map(this.getByKey);
    const data = await Promise.all(promises);
    // console.log(data);
    return data;
  }

  async getEntry(entryOptions) {}

  async getEntries() {
    log('Entering src/index.js@getEntries()');
    const allKeys = await this.getKeys('contentful:*');
    const allPromises = allKeys.map(hierItem => this.getByKey(hierItem));
    const hierarchy = await Promise.all(allPromises);
    hierarchy.forEach(item => {
      if (item.sys.contentType.sys.id === 'committee') {
        console.log(item);
        log('Attempting to retrieve links per locale in src/index.js@getEntries()');
        Object.keys(item.fields).forEach(field => {
          // We make way for locales - to enable users to deliver to different parts of the world
          Object.keys(item.fields[field]).forEach(locale => {
            const content = item.fields[field][locale];
            // we can be sure that there is a link if the field contains 'sys'
            if (Array.isArray(content) && 'contentfulRef' in content[0]) {
              log('Attempting to delete old entries and replace with key data in src/index.js@getEntries()');
              // delete the old entry because it's immutable
              delete item.fields[field][locale];
              console.log(this.handleReferences(content, false));
              item.fields[field][locale] = this.handleReferences(content, false);
              log('Formatted entries in src/index.js@getEntries()');
            }
          });
        });
      }
    });
    return hierarchy;
  }
}

module.exports = ContentfulRedisWrapper;
