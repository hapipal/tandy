'use strict';

const Joi = require('joi');
const Model = require('@hapipal/schwifty').Model;

module.exports = class Counties extends Model {

    static get tableName() {

        return 'counties';
    }

    static get joiSchema() {

        return Joi.object({

            id: Joi.number().integer().min(1),
            county: Joi.string(),
            createdAt: Joi.date().iso(),
            updatedAt: Joi.date().iso()
        });
    }

    $beforeInsert() {

        this.createdAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
    }
    $beforeUpdate() {

        this.updatedAt = new Date().toISOString();
    }
};
