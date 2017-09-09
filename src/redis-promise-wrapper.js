/**
 * Redis uses callback functions
 * which are great for old version of node
 * But we want to use promises.
 *
 * These helpers are bound to the wrapper object
 * this.store is the redis instance created within it
 */

const setKey = key => new Promise((res, rej) => {
  this.store.set(key, (err, reply) => {
    if (err) rej(err);
    res(reply);
  });
});

const getByKey = key => new Promise((res, rej) => {
  this.store.get(key, (err, reply) => {
    if (err) rej(err);
    res(reply);
  });
});

const delKey = key => new Promise((res) => {
  this.store.del(key, res);
});

const delKeys = keys => {
  const promises = [];
  keys.forEach(key => promises.push(delKey(key)));
  return promises;
};

module.exports = {
  setKey,
  getByKey,
  delKey,
  delKeys,
};
