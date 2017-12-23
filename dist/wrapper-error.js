export default class ContentfulRedisError extends Error {
    constructor(message) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
    }
    toString() {
        return `${this.name}: ${this.message}`;
    }
}
module.exports = ContentfulRedisError;
//# sourceMappingURL=wrapper-error.js.map