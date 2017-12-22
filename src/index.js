const contentful = require('contentful');
const redis = require('redis');

const redisHelper = require('./redis-promise-wrapper');
const ContentfulRedisError = require('./wrapper-error');
const { isGetter } = require('./util');
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
    log('Sync complete!');
  }

  /**
   * Get the ID and format it, for storage in redis
   * @param {Object} entry A contentful entry to store
   * @return {String} a formatted key
   */
  static formatKey(entry) {
    const entryID = entry.id || entry.entry.sys.id;
    // todo: figure out how to store content type
    return `contentful:entry:${entryID}`;
  }

  static reverseKey(key) {
    return key.replace('contentful:entry:', '');
  }

  /**
   * Given a list of deleted entries, delete those entries from redis
   * @param {Array} deletedEntries entries for deletion
   */
  async handleDeletions(deletedEntries) {
    log(`Formatting ${deletedEntries.length} items for deletion`);
    const keysToDelete = deletedEntries.map(del => del.sys.id).map(this.formatKey);
    log('Attempting to delete items from Redis in src/index.js@handleDeletions()');
    await Promise.all(this.delKeys(keysToDelete));
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
  async handleEntries(newItems) {
    log('Entering in src/index.js@handleEntries()');
    for (const item of newItems) {
      // iterate through the fields
      const { fields } = item;
      for (const field in fields) {
        const locales = fields[field];
        // dive in to the locales
        for (const locale in locales) {
          /**
           * we know we have a reference, IF the field (and it's locales) are an array
           *  and IF it's a getter
           * contentful does this to reduce traffic - at the expense of a bit of computing power
           */
          const getter = isGetter(item.fields[field], locale);
          const array = Array.isArray(item.fields[field][locale]);
          const isReference = array && getter;
          // if it's a reference, we need to attempt to replace these
          if (isReference) {
            const keys = item.fields[field][locale].map(innerLinks => innerLinks.sys.id);
            const redisKeys = keys.map(id => ContentfulRedisWrapper.formatKey({ id }));
            const newRefs = { [locale]: redisKeys };
            item.fields[field]['redis-references'] = newRefs;
            delete item.fields[field][locale];
          }
        }
      }

      // generate a key and store it in the store!
      const key = ContentfulRedisWrapper.formatKey({ id: item.sys.id });
      log(`Attempting to store ${key} entries in src/index.js@handleEntries()`);
      try {
        await this.setKey(key, item);
        log(`${key} stored. src/index.js@handleEntries()`);
      } catch (err) {
        log('Error storing entry. src/index.js@handleEntries()');
        console.error(err);
        throw new ContentfulRedisError(err);
      }
    }
  }

  async resolve({ 'redis-references': locales }) {
    // underneath this object, we have all locales
    // the aim is to keep them in one piece

  }

  /**
   * Handle the references. If we're storing data, format it correctly.
   * Else, get the references from redis
   * @param {Array<Object>} content should be a list of fields
   */
  async handleReferences(unresolved) {
    for (const key in unresolved.fields) {
      const hasRef = 'redis-references' in unresolved.fields[key];
      if (hasRef) {
        const locales = unresolved.fields[key]['redis-references'];
        for (const locale in locales) {
          const references = locales[locale];
          // even if there's one link, we store it in an array, for ease
          for (const refKey of references) {
            // resolve the entry from redis
            const referee = await this.getByKey(refKey);
            unresolved.fields[key][locale] = referee;
          }
        }
      }
    }
    return unresolved;
  }

  /**
   * Get and resolve a single entry from our store
   * @param {Object} entryOptions Options passed - should mirror contentful
   */
  async getEntry(entryOptions) {
    const { id } = entryOptions;
    // format the ID in to something that the store will recognise
    const formatted = ContentfulRedisWrapper.formatKey({ id });
    const entry = await this.getByKey(formatted);
    // recur and find all links
    const resolved = await this.handleReferences(entry);
    return resolved;
  }

  /**
   * 1. Get all of the entries from redis
   * 2. Go through all of those fields, and retrieve their references
   * 3. Recur through the references and handle their references - TODO?
   */
  async getEntries() {
    log('Entering src/index.js@getEntries()');
    // get all keys, and then get data from redis based on these
    const allKeys = await this.getKeys('contentful:*');
    const allPromises = allKeys.map(hierItem => this.getByKey(hierItem));
    const hierarchy = await Promise.all(allPromises);

    // attempt to resolve links
    for (const item of hierarchy) {
      log('Attempting to retrieve links per locale in src/index.js@getEntries()');
      const { fields } = item;
      // go through the fields. If a 'reference' field exists, handle that reference
      for (const field in fields) {
        // if we've set a reference, we'll rectify it for every locale
        if ('references' in item.fields[field]) {
          const references = item.fields[field].references;
          // fix references based on locale
          for (const refLocale in references) {
            const refPromises = references[refLocale].map(this.getByKey);
            const referees = await Promise.all(refPromises);
            item.fields[field][refLocale] = referees;
            delete references[refLocale];
          }
          delete item.fields[field].references;
        }
      }
    }
    return hierarchy;
  }
}

module.exports = ContentfulRedisWrapper;
