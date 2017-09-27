'use strict';

exports.up = function (knex, Promise) {

    return Promise.all([

        knex.schema.createTable('users', (table) => {

            table.increments('id').primary();
            table.string('email').notNullable();
            table.string('password');
            table.string('firstName').notNullable();
            table.string('lastName').notNullable();
            table.string('resetToken');
        })
    ]);
};

exports.down = function (knex, Promise) {

    return Promise.all([
        knex.schema.dropTable('users')
    ]);
};
