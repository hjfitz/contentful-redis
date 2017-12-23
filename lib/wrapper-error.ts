export default class ContentfulRedisError extends Error {
    name: string;
    constructor(message) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
    }

    toString(): string {
        return `${this.name}: ${this.message}`
    }
}

module.exports = ContentfulRedisError;
