'use strict';
const Model = require('schwifty').Model;
const Joi = require('joi');

module.exports = class Users extends Model {

    static get tableName() {

        return 'users';
    }

    static get joiSchema() {

        return Joi.object({

            id: Joi.number(),
            email: Joi.string().email(),
            password: Joi.string().allow(null),
            firstName: Joi.string(),
            lastName: Joi.string(),
            resetToken: Joi.string().allow(null)
        });
    }

    static get relationMappings() {

        return {
            tokens: {
                relation: Model.HasManyRelation,
                modelClass: require('./tokens'),
                join: {
                    from: 'users.id',
                    to: 'Tokens.user'
                }
            }
        };
    }
};
