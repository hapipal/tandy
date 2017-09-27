'use strict';

const Boom = require('boom');

/**
 * Create Record
 *
 * post /:modelIdentity
 *
 * An API call to find and return a single model instance from the data adapter
 * using the specified criteria.  If an id was specified, just the instance with
 * that unique id will be returned.
 *
 */

module.exports = function createRecord(route, options){

    return (request, reply) => {

        const actionUtil = require('../actionUtil')(request, options);

        const Model = actionUtil.parseModel();

        Model.query().insertAndFetch(request.payload).asCallback((error, model) => {

            if (error){
                return reply(Boom.wrap(error));
            }
            return reply(model).code(201);
        });
    };

};
