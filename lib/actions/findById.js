'use strict';

const Boom = require('boom');

/**
 * Find by Id
 *
 * get /:modelIdentity/:id
 *
 * An API call to find and return a single model instance from the data adapter
 * using the specified id.
 *
 */

module.exports = function findOneRecord(route, options) {

    return (request, reply) => {

        const actionUtil = require('../actionUtil')(request, options);

        const Model = actionUtil.modelFromParam(options.model);
        const keys = actionUtil.getKeys();

        Model.query().findById(keys.parent.value).asCallback((modelErr, foundModel) => {

            if (modelErr) {
                return reply(Boom.wrap(modelErr));
            }
            if (!foundModel) {
                return reply(Boom.notFound('Record not found.'));
            }
            reply(foundModel);
        });
    };
};
