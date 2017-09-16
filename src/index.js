const contentful = require('contentful');
const redis = require('redis');

const redisHelper = require('./redis-promise-wrapper');
const ContentfulRedisError = require('./wrapper-error');
const util = require('./util');
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
      // iterate through the fields
      Object.keys(item.fields).forEach(field => {
        // dive in to the locales
        Object.keys(item.fields[field]).forEach(locale => {
          // we know we have a reference, IF the field (and it's locales) are an array
          // and IF it's a getter - contentful does this to reduce traffic - at the expense of a bit of computing power
          const isReference = Array.isArray(item.fields[field][locale]) && util.isGetter(item.fields[field], locale);
          // if it's a reference, we need to attempt to replace these
          if (isReference) {
            const keys = item.fields[field][locale].map(innerLinks => innerLinks.sys.id);
            const redisKeys = keys.map(id => ({ locale, ref: ContentfulRedisWrapper.formatKey({ id }) }));
            item.fields[field].references = redisKeys;
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
   */
  async handleReferences(content) {
    // const { references } = content;
    // const datastoreKeys = content.map(contentItem => contentItem.contentfulRef);
    // console.log(references);
    // const promises = datastoreKeys.map(this.getByKey);
    // const data = await Promise.all(promises);
    // return data;
  }

  // todo
  async getEntry(entryOptions) {}

  async getEntries() {
    log('Entering src/index.js@getEntries()');
    const allKeys = await this.getKeys('contentful:*');
    const allPromises = allKeys.map(hierItem => this.getByKey(hierItem));
    const hierarchy = await Promise.all(allPromises);
    hierarchy.forEach(item => {
      log('Attempting to retrieve links per locale in src/index.js@getEntries()');
      Object.keys(item.fields).forEach(field => {
        // We make way for locales - to enable users to deliver to different parts of the world
        Object.keys(item.fields[field]).forEach(async locale => {
          // we can be sure that there is a link if the field contains 'sys'
          if ('references' in item.fields[field]) {

            // LEFT OFF
            // working on joining our REFERENCES with item.fields[field][locale]

          }
        });
      });
    });
    return hierarchy;
  }
}

module.exports = ContentfulRedisWrapper;
