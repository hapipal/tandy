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
        }),

        knex.schema.createTable('tokens', (table) => {

            table.increments('id').primary();
            table.integer('user')
                .references('id')
                .inTable('users');
            table.string('temp');
        })
    ]);
};

exports.down = function (knex, Promise) {

    return Promise.all([
        knex.schema.dropTable('users'),
        knex.schema.dropTable('tokens')
    ]);
};
