/**
 * Redis uses callback functions.
 * which are great.
 * Promises are better.
 *
 * These helpers are bound to the wrapper object
 * this.store is the redis instance created within it
 */

export default {
  setKey(key: string, val: Object): Promise<Error|string> {
    return new Promise((res: Function, rej: Function) => {
      const formattedVal: string = JSON.stringify(val);
      this.store.set(key, formattedVal, (err: Error, reply: string) => {
        if (err) rej(err);
        res(reply);
      });
    });
  },

  getByKey(key: string): Promise<Error|Object> {
    return new Promise((res: Function, rej: Function) => {
      this.store.get(key, (err: Error, reply: string) => {
        if (err) rej(err);
        res(JSON.parse(reply));
      });
    });
  },

  delKey(key: string): Promise<string> {
    return new Promise((res: Function) => {
      this.store.del(key, res);
    });
  },

  getKeys(key: string): Promise<Error|string> {
    return new Promise((res, rej) => {
      this.store.keys(key, (err, replies) => {
        if (err) rej(err);
        res(replies);
      });
    });
  },

  // map this.delKey to our keys, as it's bound to the same obj
  delKeys(keys: string[]) {
    keys.map(this.delKey);
  },
};
