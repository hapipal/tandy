'use strict';

const Boom = require('@hapi/boom');
const Ref = require('objection').ref;
const Actions = require('../action-util');
/**
 * Populate an association
 *
 * get /model/:parentid/:relation
 * get /model/:parentid/:relation/count
 * get /model/:parentid/:relation/:id
 *
 * @param {Object} where       - the find criteria (passed directly to the ORM)
 * @param {Integer} limit      - the maximum number of records to send back (useful for pagination)
 * @param {Integer} skip       - the number of records to skip (useful for pagination)
 * @param {String} sort        - the order of returned records, e.g. `name ASC` or `age DESC`
 *
 */

module.exports = function expand(route, options) {

    return async (request, h) => {

        const actionUtil = Actions(request, options, h);

        const Model = actionUtil.modelFromParam(options.model);
        const relation  = options.associationAttr;
        const RelationModel = actionUtil.modelFromParam(options.associationAttr);

        if (!RelationModel) {
            return Boom.badImplementation('Invalid relation for populate');
        }

        const keys = actionUtil.getKeys();
        const limit = actionUtil.parseLimit();
        const sort = actionUtil.parseSort(Model);
        const rangeStart = actionUtil.parseSkip();
        const rangeEnd = rangeStart + limit;

        let total;

        const modelFullQuery = Model.query().findById(keys.parent.value)
            .withGraphFetched(relation)
            .modifyGraph(relation, (builder) => {

                if (keys.child?.value) {
                    builder.where(Ref(RelationModel.tableName + '.' + keys.child.key), '=', keys.child.value);
                }

                if (options.includeTotalCount) {
                    // we need to wrap this in an async iffe to trigger the query,
                    // as otherwise the main query gets borked
                    total = (async () => await builder.clone().count({ total: Ref(RelationModel.tableName + '.' + keys.child.key) }).first())();
                }

                builder.range(rangeStart, rangeEnd).limit(limit);

                if (sort) {
                    builder.orderByRaw(sort);
                }
            });

        const modelFull = await modelFullQuery;

        if (!modelFull) {
            return Boom.notFound('No record found with the specified id.');
        }

        if (keys.child?.value) {
            if (modelFull[options.associationAttr].length) {
                return h.response().code(204);
            }

            return Boom.notFound();
        }

        if (total) {
            return actionUtil.replyWithRange(options.associationAttr, rangeStart, rangeEnd, await total, modelFull[options.associationAttr]);
        }

        if (options._private.count) {
            return modelFull[options.associationAttr].length;
        }

        return modelFull[options.associationAttr];
    };
};
