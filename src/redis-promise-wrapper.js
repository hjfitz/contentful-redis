/**
 * Redis uses callback functions
 * which are great for old version of node
 * But we want to use promises.
 *
 * These helpers are bound to the wrapper object
 * this.store is the redis instance created within it
 */

module.exports = {
  setKey(key, val) {
    return new Promise((res, rej) => {
      const formattedVal = JSON.stringify(val);
      this.store.set(key, formattedVal, (err, reply) => {
        if (err) rej(err);
        res(reply);
      });
    });
  },

  getByKey(key) {
    return new Promise((res, rej) => {
      this.store.get(key, (err, reply) => {
        if (err) rej(err);
        res(JSON.parse(reply));
      });
    });
  },

  delKey(key) {
    return new Promise(res => {
      this.store.del(key, res);
    });
  },

  getKeys(key) {
    return new Promise((res, rej) => {
      this.store.keys(key, (err, replies) => {
        if (err) rej(err);
        res(replies);
      });
    });
  },

  // map this.delKey to our keys, as it's bound to the same obj
  delKeys(keys) {
    keys.map(this.delKey);
  },
};
