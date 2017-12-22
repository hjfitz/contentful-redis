module.exports = {
  isGetter: (obj, prop) => !!Object.getOwnPropertyDescriptor(obj, prop).get,
};

