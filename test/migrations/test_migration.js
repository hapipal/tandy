'use strict';

exports.up = (knex) => {

    return knex.schema.createTable('users', (table) => {

        table.increments('id').primary();
        table.string('email').notNullable();
        table.string('password');
        table.string('firstName').notNullable();
        table.string('lastName').notNullable();
        table.string('resetToken');
    }).createTable('tokens', (table) => {

        table.increments('id').primary();
        table.integer('user')
            .references('id')
            .inTable('users');
        table.string('temp');
    }).createTable('counties', (table) => {

        table.increments('id').primary();
        table.string('county').notNullable();
        table.timestamp('createdAt');
        table.timestamp('updatedAt');
    });
};

exports.down = (knex) => {

    return knex.schema.dropTable('users')
        .dropTable('tokens')
        .dropTable('counties');
};
