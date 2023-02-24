'use strict';

const Actions = require('../action-util');

/**
 * Find Records
 *
 *  get   /:modelIdentity
 *
 * An API call to find and return model instances from the data adapter
 * using the specified criteria.  If an id was specified, just the instance
 * with that unique id will be returned.
 *
 * Optional:
 * @param {Object} where       - the find criteria (passed directly to the ORM)
 * @param {Integer} limit      - the maximum number of records to send back (useful for pagination)
 * @param {Integer} skip       - the number of records to skip (useful for pagination)
 * @param {String} sort        - the order of returned records, e.g. `name ASC` or `age DESC`
 *
 */

module.exports = function findRecords(route, options) {

    return async (request, h) => {

        const actionUtil = Actions(request, options, h);
        // Look up the model
        const Model = actionUtil.parseModel();
        // Lookup for records that match the specified criteria.  Are we just counting?
        if (options._private.count) {

            const modelCount = await Model.query().count({ total: '*' }).first();
            return modelCount.total;
        }

        const limit = actionUtil.parseLimit();
        const sort = actionUtil.parseSort(Model);
        const rangeStart = actionUtil.parseSkip();
        const rangeEnd = rangeStart ? rangeStart + limit : limit;
        const where = actionUtil.parseWhere(Model);

        const foundModelsQuery = Model.query();

        if (where) {
            foundModelsQuery.where(where);
        }

        let total;

        if (options.includeTotalCount) {
            total = await foundModelsQuery.clone().count({ total: '*' }).first();
        }

        if (sort) {
            foundModelsQuery.orderByRaw(sort);
        }

        foundModelsQuery.range(rangeStart, rangeEnd).limit(limit);

        const foundModels = await foundModelsQuery;

        if (total) {
            return actionUtil.replyWithRange(options.model, rangeStart, rangeEnd, total, foundModels.results);
        }

        return foundModels.results;

    };
};
