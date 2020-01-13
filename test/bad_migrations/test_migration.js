'use strict';

exports.up = (knex) => {

    return knex.schema.createTable('users', (table) => {

        table.increments('id').primary();
        table.string('email').notNullable();
        table.string('password');
        table.string('firstName').notNullable();
        table.string('lastName').notNullable();
        table.string('resetToken');
    });
};

exports.down = (knex) => {

    return knex.schema.dropTable('users');
};
