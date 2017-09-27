'use strict';

exports.seed = function (knex, Promise) {

    return knex('users').then(() => {

        return Promise.all([
            // Inserts seed entries
            knex('users').insert({ id: 1, email: 'a@b.c', firstName: 'a', lastName: 'b' }),
            knex('users').insert({ id: 2, email: 'c@d.e', firstName: 'c', lastName: 'd' }),
            knex('users').insert({ id: 3, email: 'a@d.e', firstName: 'a', lastName: 'd' }),
            knex('users').insert({ id: 4, email: 'd@d.e', firstName: 'd', lastName: 'd' }),
            knex('tokens').insert({ id: 99, temp: 'text', user: 1 }),
            knex('tokens').insert({ id: 98, temp: 'test', user: 1 }),
            knex('tokens').insert({ id: 97, temp: 'noUser', user: null })
        ]);
    });
};
