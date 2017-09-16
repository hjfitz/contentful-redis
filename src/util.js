const isGetter = (obj, prop) => !!Object.getOwnPropertyDescriptor(obj, prop).get;

module.exports = {
  isGetter,
};

