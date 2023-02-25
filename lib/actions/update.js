'use strict';

const Boom = require('@hapi/boom');

const Actions = require('../action-util');
/**
 * Update One Record
 *
 * An API call to update a model instance with the specified `id`,
 * treating the other unbound parameters as attributes.
 *
 */

module.exports = function updateOneRecord(route, options) {

    return async (request, h) => {

        const actionUtil = Actions(request, options, h);

        // Look up the model
        const Model = actionUtil.parseModel();
        const primaryKey = actionUtil.getKeys().parent.value;

        const patchedModel = await Model.query().patchAndFetchById(primaryKey, request.payload);

        if (!patchedModel) {
            return Boom.notFound('No record found with the specified `id`.');
        }

        return patchedModel;
    };
};
