'use strict';

const Hoek = require('@hapi/hoek');

const internals = {};

/**
 * Utility methods used in built-in actions.
 *
 * @type {Object}
 */
module.exports = (request, options) => {

    return {

        /**
         * Get Model Object for a given url param. Convention is for Models to be
         * capitalized, but if that fails, try as-found too.
         *
         * @param  {Request} request
         * @param  {Object} options
         * @param  {String} modelName
         * @return {Object} Found Model
         */
        modelFromParam: (param) => {

            if (!param || typeof param !== 'string') {
                return null;
            }

            const capitalized = param.charAt(0).toUpperCase() + param.slice(1);
            let Model = request.models()[capitalized];

            //if capitalized wasn't found, try it as it was in the options
            if (!Model) {
                Model = request.models()[param];
            }

            return Model;
        },
        getKeys: function () {

            const Model = this.modelFromParam(options.model);
            const keys = {
                parent: {
                    key: Model.idColumn,
                    value: (request.paramsArray.length > 0) ? request.paramsArray[0] : this.getUserId()
                }
            };
            if (options.associationAttr){

                keys.child = {
                    key: Model.idColumn,
                    value: (request.paramsArray.length > 1) ? request.paramsArray[1] : undefined
                };
            }

            return keys;
        },

        /**
         * Determine the model class to use w/ this blueprint action.
         * @param  {Request} request
         * @param  {Object} options
         * @return {Model}
         */
        parseModel: () => {

            // Ensure a model can be deduced from the request options.

            //try capitalizing model first
            const model = options.model.charAt(0).toUpperCase() + options.model.slice(1);
            let Model = request.models(true)[model];

            //if capitalized wasn't found, try it as it was in the options
            if (!Model) {
                Model = request.models()[options.model];
            }

            return Model;
        },

        /**
         * @param  {Request} request
         * @param  {Object} options
         */
        parseSort: () => {

            return request.query.sort || options.sort || undefined;
        },

        /**
         * @param  {Request} request
         * @param  {Object} options
         */
        parseLimit: () => {

            const DEFAULT_LIMIT = 30;
            let limit;

            if (request.query.limit) {
                limit = Math.abs(request.query.limit);
            }
            else if (typeof options.limit !== 'undefined') {
                limit = options.limit;
            }
            else {
                limit = DEFAULT_LIMIT;
            }

            return limit;
        },

        /**
         * @param  {Request} request
         * @param  {Object} options
         */

        parseSkip: () => {

            const DEFAULT_SKIP = 0;
            let skip;

            if (request.query.skip) {
                skip = Math.abs(request.query.skip);
            }
            else if (typeof options.limit !== 'undefined') {
                skip = options.skip;
            }
            else {
                skip = DEFAULT_SKIP;
            }

            return skip;
        },

        getUserId: () => {

            Hoek.assert(options.actAsUser, 'Not currently acting as user, per `options.actAsUser`.');
            Hoek.assert(typeof options.userIdProperty === 'string', '`options.userIdProperty` must be a string.');
            Hoek.assert(request.auth.credentials, 'Unable to get user ID from credentials');

            const userId = Hoek.reach(request.auth.credentials, options.userIdProperty);

            return userId;
        }
    };
};
