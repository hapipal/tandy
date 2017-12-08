'use strict';

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

        const actionUtil  = require('../actionUtil')(request, options);

        // Look up the model
        const Model = actionUtil.parseModel();
        // Lookup for records that match the specified criteria.  Are we just counting?
        if (options._private.count) {

            const modelCount = await Model.query().count();
            //this feels fragile, but I don't see another way to get at the data
            return modelCount[0]['count(*)'];
        }
        const limit = actionUtil.parseLimit();
        const sort = actionUtil.parseSort();
        const rangeStart = actionUtil.parseSkip();
        const rangeEnd = rangeStart ? rangeStart + limit : limit;

        const foundModels = await Model.query()
            .skipUndefined()
            .range(rangeStart, rangeEnd)
            .limit(limit)
            .orderByRaw(sort);
        return foundModels.results;
    };
};
