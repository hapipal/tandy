'use strict';

const Boom = require('boom');

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

    return (request, reply) => {

        const actionUtil = require('../actionUtil')(request, options);

        const Model = actionUtil.parseModel();
        const keys = actionUtil.getKeys();

        Model.query().deleteById(keys.parent.value)
            .asCallback((error, rowsDeleted) => {

                if (error) {
                    return reply(error);
                }

                if (rowsDeleted === 1) {
                    return reply().code(204);
                }

                return reply(Boom.notFound('Record not found'));
            });
    };
};
