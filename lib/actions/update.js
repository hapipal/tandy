'use strict';

const Boom = require('boom');

/**
 * Update One Record
 *
 * An API call to update a model instance with the specified `id`,
 * treating the other unbound parameters as attributes.
 *
 */

module.exports = function updateOneRecord(route, options) {

    return (request, reply) => {

        const actionUtil = require('../actionUtil')(request, options);

        // Look up the model
        const Model = actionUtil.parseModel();

        const primaryKey = actionUtil.getKeys().parent.value;

        Model.query().patchAndFetchById(primaryKey, request.payload).asCallback((patchErr, patchedModel) => {

            if (patchErr) {
                return reply(Boom.wrap(patchErr));
            }

            if (!patchedModel) {
                return reply(Boom.notFound('No record found with the specified `id`.'));
            }

            return reply(patchedModel);
        });
    };
};
