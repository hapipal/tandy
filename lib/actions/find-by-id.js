'use strict';

const Boom = require('@hapi/boom');

const Actions = require('../action-util');
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

    return async (request, h) => {

        const actionUtil = Actions(request, options, h);

        const Model = actionUtil.modelFromParam(options.model);
        const keys = actionUtil.getKeys();

        const foundModel = await Model.query().findById(keys.parent.value);

        if (!foundModel) {
            return Boom.notFound('Record not found.');
        }

        return foundModel;
    };
};
