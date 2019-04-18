'use strict';

const Boom = require('@hapi/boom');

const Actions = require('../action-util');
/**
 * delete /model/:parentid/relation/:id
 *
 * Remove a member from an association
 *
 */

module.exports = function remove(route, options) {

    return async (request, h) => {

        const actionUtil = Actions(request, options);

        const Model = actionUtil.modelFromParam(options.model);
        const keys = actionUtil.getKeys();
        const foundModel = await Model.query().findById(keys.parent.value);

        if (!foundModel) {
            return Boom.notFound('No record found with the specified `id`.');
        }

        const updatedTokenId = await foundModel.$relatedQuery(options.associationAttr)
            .unrelate()
            .where(keys.child.key, keys.child.value);

        if (!updatedTokenId) {
            return Boom.notFound('No record found with the specified `id`.');
        }

        return h.response().code(204);
    };
};
