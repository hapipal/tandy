'use strict';

const Actions = require('../actionUtil');
/**
 * Create Record
 *
 * post /:modelIdentity
 *
 * An API call to find and return a single model instance from the data adapter
 * using the specified criteria.  If an id was specified, just the instance with
 * that unique id will be returned.
 *
 */

module.exports = function createRecord(route, options) {

    return async (request, h) => {

        const actionUtil = Actions(request, options);
        const Model = actionUtil.parseModel();

        return h.response(await Model.query().insertAndFetch(request.payload)).code(201);
    };
};
