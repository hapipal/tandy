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

    return async (request) => {

        const actionUtil = Actions(request, options);
        // Look up the model
        const Model = actionUtil.parseModel();
        // Lookup for records that match the specified criteria.  Are we just counting?
        if (options._private.count) {

            const modelCount = await Model.query().count().first();
            return modelCount[Object.keys(modelCount)[0]];
        }

        const limit = actionUtil.parseLimit();
        const sort = actionUtil.parseSort(Model);
        const rangeStart = actionUtil.parseSkip();
        const rangeEnd = rangeStart ? rangeStart + limit : limit;
        const where = actionUtil.parseWhere(Model);

        const foundModelsQuery = Model.query().range(rangeStart, rangeEnd).limit(limit);

        if (where) {
            foundModelsQuery.where(where);
        }

        if (sort) {
            foundModelsQuery.orderByRaw(sort);
        }

        const foundModels = await foundModelsQuery;

        return foundModels.results;

    };
};
