'use strict';

const Boom = require('boom');

/**
 * delete /model/:parentid/relation/:id
 *
 * Remove a member from an association
 *
 */

module.exports = function remove(route, options) {

    return (request, reply) => {

        const actionUtil = require('../actionUtil')(request, options);

        const Model = actionUtil.modelFromParam(options.model);
        const keys = actionUtil.getKeys();
        Model.query().findById(keys.parent.value).asCallback((modelErr, foundModel) => {

            if (modelErr) {
                return reply(Boom.wrap(modelErr));
            }

            if (!foundModel) {
                return reply(Boom.notFound('No record found with the specified `id`.'));
            }

            foundModel.$relatedQuery(options.associationAttr)
                .unrelate()
                .where(keys.child.key, keys.child.value)
                .asCallback((updateErr, updatedTokenId) => {

                    if (updateErr) {
                        return reply(Boom.wrap(updateErr));
                    }

                    if (!updatedTokenId) {
                        return reply(Boom.notFound('No record found with the specified `id`.'));
                    }
                    return reply().code(204);
                });
        });
    };
};
