import assert = require('assert');
import TMError = require('./TMError');

function tmassert(value: any, message?: string) {
    try {
        assert(value, message);
    } catch (error) {
        throw new TMError(true, error.message);
    }
}

export = tmassert;