'use strict';

const Boom = require('@hapi/boom');

const Actions = require('../action-util');
/**
 * Add Record To Collection
 *
 * post  /:modelIdentity/:id/:collectionAttr/:childid
 *
 * Associate one record with the collection attribute of another.
 * e.g. add a Horse named "Jimmy" to a Farm's "animals".
 * If the record being added has a primary key value already, it will
 * just be linked.  If it doesn't, a new record will be created, then
 * linked appropriately.  In either case, the association is bidirectional.
 *
 */

module.exports = function addToCollection(route, options) {

    return async (request, h) => {

        const actionUtil = Actions(request, options, h);

        // Ensure a model and alias can be deduced from the request.
        const Model = actionUtil.modelFromParam(options.model);

        const keys = actionUtil.getKeys();
        const foundModel = await Model.query().findById(keys.parent.value);

        if (!foundModel) {
            return Boom.notFound('No record found with the specified `id`.');
        }

        //if a key was specified for the relation, we're linking an existing.
        if (keys.child.value) {

            const updatedTokenId = await foundModel.$relatedQuery(options.associationAttr)
                .relate(keys.child.value);

            if (!updatedTokenId) {
                return Boom.notFound('No record found with the specified `id`.');
            }

            return h.response().code(204);
        }

        return h.response(await foundModel.$relatedQuery(options.associationAttr).insert(request.payload)).code(201);
    };
};
