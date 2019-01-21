'use strict';

const Boom = require('boom');
const Ref = require('objection').ref;
const Actions = require('../action-util');
/**
 * Populate an association
 *
 * get /model/:parentid/relation
 * get /model/:parentid/relation/count
 * get /model/:parentid/relation/:id
 *
 * @param {Object} where       - the find criteria (passed directly to the ORM)
 * @param {Integer} limit      - the maximum number of records to send back (useful for pagination)
 * @param {Integer} skip       - the number of records to skip (useful for pagination)
 * @param {String} sort        - the order of returned records, e.g. `name ASC` or `age DESC`
 *
 */

module.exports = function expand(route, options) {

    return async (request, h) => {

        const actionUtil = Actions(request, options);

        const Model = actionUtil.modelFromParam(options.model);
        const relation  = options.associationAttr;
        const RelationModel = actionUtil.modelFromParam(options.associationAttr);

        if (!RelationModel) {
            return Boom.badImplementation('Invalid relation for populate');
        }

        const keys = actionUtil.getKeys();
        const limit = actionUtil.parseLimit();
        const sort = actionUtil.parseSort();
        const rangeStart = actionUtil.parseSkip();
        const rangeEnd = rangeStart + limit;

        const modelFull = await Model.query().skipUndefined().findById(keys.parent.value).eager(relation)
            .modifyEager(relation, (builder) => {

                builder.skipUndefined()
                    .where(Ref(RelationModel.tableName + '.' + keys.child.key), '=', keys.child.value)
                    .range(rangeStart, rangeEnd)
                    .limit(limit)
                    .orderByRaw(sort);
            });


        if (!modelFull){
            return Boom.notFound('No record found with the specified id.');
        }

        if (keys.child.value){
            if (modelFull[options.associationAttr].length) {
                return h.response().code(204);
            }

            return Boom.notFound();
        }

        if (options._private.count) {
            return modelFull[options.associationAttr].length;
        }

        return modelFull;
    };
};
