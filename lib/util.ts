const isGetter = (obj: Object, prop: string): boolean => !!Object.getOwnPropertyDescriptor(obj, prop).get,

export { isGetter };

