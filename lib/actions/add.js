'use strict';

const Boom = require('boom');

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

    return (request, reply) => {

        const actionUtil = require('../actionUtil')(request, options);

        // Ensure a model and alias can be deduced from the request.
        const Model = actionUtil.modelFromParam(options.model);

        const keys = actionUtil.getKeys();

        Model.query().findById(keys.parent.value).asCallback((modelErr, foundModel) => {

            if (modelErr) {
                return reply(Boom.wrap(modelErr));
            }

            if (!foundModel) {
                return reply(Boom.notFound('No record found with the specified `id`.'));
            }
            //if a key was specified for the relation, we're linking an exsiting.
            if (keys.child.value) {

                foundModel.$relatedQuery(options.associationAttr)
                .relate(keys.child.value)
                .asCallback((updateErr, updatedTokenId) => {

                    if (updateErr){
                        return reply(Boom.wrap(updateErr));
                    }

                    if (!updatedTokenId) {
                        return reply(Boom.notFound('No record found with the specified `id`.'));
                    }
                    return reply().code(204);
                });
            }
            else {
                foundModel.$relatedQuery(options.associationAttr)
                .insert(request.payload)
                .asCallback((insertErr, newToken) => {

                    if (insertErr){
                        return reply(Boom.wrap(insertErr));
                    }
                    return reply(newToken).code(201);
                });
            }
        });
    };
};
