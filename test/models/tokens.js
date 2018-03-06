'use strict';

const Joi = require('joi');
const Model = require('schwifty').Model;

//lowercase t to exercise tests
module.exports = class tokens extends Model {

    static get tableName() {

        return 'Tokens';
    }

    static get joiSchema() {

        return Joi.object({

            user: Joi.any(),
            temp: Joi.string(),
            id: Joi.number()
        });
    }

    static get relationMappings() {

        return {
            users: {
                relation: Model.BelongsToOneRelation,
                modelClass: require('./users'),
                join: {
                    from: 'users.id',
                    to: 'Tokens.user'
                }
            }
        };
    }
};
