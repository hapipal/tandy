'use strict';

const Boom = require('boom');

const Actions = require('../actionUtil');
/**
 * Destroy One Record
 *
 * delete  /:modelIdentity/:id
 *
 * Destroys the single model instance with the specified `id` from
 * the data adapter for the given model if it exists.
 *
 */
module.exports = function destroyOneRecord(route, options) {

    return async (request, h) => {

        const actionUtil = Actions(request, options);

        const Model = actionUtil.parseModel();
        const keys = actionUtil.getKeys();

        const rowsDeleted = await Model.query().deleteById(keys.parent.value);

        if (rowsDeleted === 0) {
            return Boom.notFound('Record not found');
        }
        return h.response().code(204);
    };
};
