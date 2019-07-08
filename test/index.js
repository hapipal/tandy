'use strict';

const Lab = require('@hapi/lab');
const Hapi = require('@hapi/hapi');
const Joi = require('@hapi/joi');
const Hoek = require('@hapi/hoek');
const Boom = require('@hapi/boom');
const Schwifty = require('schwifty');
const Tandy = require('..');
const TestModels = require('./models');

const { before, describe, expect, it } = exports.lab = Lab.script();

describe('Tandy', () => {

    const getOptions = (extras) => {

        const options = {
            schwifty: {
                migrateOnStart: true,
                migrationsDir: 'test/migrations',
                knex: {
                    client: 'sqlite3',
                    useNullAsDefault: true,
                    connection: {
                        filename: ':memory:'
                    }
                }
            },
            tandy: {
                actAsUser: true,
                userIdProperty: 'user.id',
                userUrlPrefix: '/user',
                userModel: 'users',
                prefix: ''
            }
        };

        return Hoek.applyToDefaults(options, extras || {});
    };

    const scheme = (server, options) => {

        return {
            authenticate: (request, h) => {

                const req = request.raw.req;
                const authorization = req.headers.authorization;

                if (!authorization || authorization !== 'dontcare') {
                    return h.unauthenticated(Boom.unauthorized(null, 'Custom'));
                }

                return h.authenticated({ credentials: { user: { id: 1 } } });
            }
        };
    };

    const getServer = async (options) => {

        const server = Hapi.Server({ debug: { request: false } });

        server.auth.scheme('custom', scheme);
        server.auth.strategy('mine', 'custom');

        await server.register([
            {
                plugin: Schwifty,
                options: options.schwifty
            },
            {
                plugin: Tandy,
                options: options.tandy
            }
        ]);

        return server;
    };

    before(() => {

        require('sqlite3'); // Just warm-up sqlite, so that the tests have consistent timing

    });

    it('throws when given an invalid prefix', async () => {

        const config = getOptions({
            tandy: {
                // Globally set prefix, invalid URL segment
                prefix: 'no-leading-slash'
            }
        });

        const server = await getServer(config);
        await server.initialize();

        try {
            server.route({
                method: 'GET',
                path: '/route',
                handler: { tandy: {} }
            });
        }
        catch (err) {
            expect(err).to.be.an.error();
            expect(err).to.be.an.error('Prefix parameter should be a string following the pattern: /^\\/.+/');
        }

        try {
            server.route({
                method: 'GET',
                path: '/route',
                handler: {
                    tandy: {
                        // Route-specific invalid prefix value
                        prefix: 5
                    }
                }
            });
        }
        catch (err) {
            expect(err).to.be.an.error();
            expect(err).to.be.an.error('Prefix parameter should be a string following the pattern: /^\\/.+/');
        }
    });

    it('ignores the given prefix if not an exact match at the start of the route path', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            },
            tandy: {
                prefix: '/prefix'
            }
        });

        const server = await getServer(config);
        await server.initialize();

        try {
            server.route({
                method: 'POST',
                path: '/users/prefix',
                config: {
                    description: 'Register new user',
                    validate: {
                        payload: {
                            email: Joi.string().email().required(),
                            password: Joi.string().required(),
                            firstName: Joi.string().required(),
                            lastName: Joi.string().required()
                        }
                    },
                    auth: false
                },
                handler: { tandy: {} }
            });
        }
        catch (err) {
            expect(err).to.be.an.error();
            // Signifies prefix was failed to be removed, so path was misinterpreted
            expect(err).to.be.an.error('This post route does not match a Tandy pattern.');
        }
    });

    it('replaces prefix if found at the start of the given route\'s path', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            },
            tandy: {
                prefix: '/prefix'
            }
        });

        const server = await getServer(config);
        await server.initialize();

        server.route({
            method: 'POST',
            path: '/prefix/users',
            config: {
                description: 'Register new user',
                validate: {
                    payload: {
                        email: Joi.string().email().required(),
                        password: Joi.string().required(),
                        firstName: Joi.string().required(),
                        lastName: Joi.string().required()
                    }
                },
                auth: false
            },
            handler: { tandy: {} }
        });

        const options = {
            method: 'POST',
            url: '/prefix/users',
            payload: {
                email: 'test@test.com',
                password: 'password',
                firstName: 'Test',
                lastName: 'Test'
            }
        };

        const res = await server.inject(options);

        const result = res.result;

        expect(res.statusCode).to.equal(201);
        expect(result).to.be.an.object();
        expect(result.email).to.equal('test@test.com');
    });

    it('creates a new user', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        server.route({
            method: 'POST',
            path: '/users',
            config: {
                description: 'Register new user',
                validate: {
                    payload: {
                        email: Joi.string().email().required(),
                        password: Joi.string().required(),
                        firstName: Joi.string().required(),
                        lastName: Joi.string().required()
                    }
                },
                auth: false
            },
            handler: { tandy: {} }
        });

        const options = {
            method: 'POST',
            url: '/users',
            payload: {
                email: 'test@test.com',
                password: 'password',
                firstName: 'Test',
                lastName: 'Test'
            }
        };

        const res = await server.inject(options);

        const result = res.result;

        expect(res.statusCode).to.equal(201);
        expect(result).to.be.an.object();
        expect(result.email).to.equal('test@test.com');
    });
    it('Generates an Objection error when creating a new token', async () => {

        const Model = require('schwifty').Model;

        const Tokens = class tokens extends Model {

            static get tableName() {

                return 'foo';
            }
        };

        const config = getOptions({
            schwifty: {
                models: [Tokens]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        server.route({
            method: 'POST',
            path: '/tokens',
            config: {
                description: 'Register new token',
                auth: false
            },
            handler: { tandy: {} }
        });

        const options = {
            method: 'POST',
            url: '/tokens',
            payload: {
                temp: 'Test'
            }
        };
        const response = await server.inject(options);

        expect(response.statusCode).to.equal(500);
    });
    it('Updates a user with PATCH', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'PATCH',
            path: '/users/{id}',
            config: {
                description: 'Update user',
                validate: {
                    payload: {
                        email: Joi.string().email(),
                        password: Joi.string(),
                        firstName: Joi.string(),
                        lastName: Joi.string()
                    },
                    params: {
                        id: Joi.number().integer().required()
                    }
                },
                auth: false
            },
            handler: { tandy: {} }
        });

        const options = {
            method: 'PATCH',
            url: '/users/1',
            payload: {
                email: 'test@test.com'
            }
        };

        const response = await server.inject(options);
        const result = response.result;
        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.object();
        expect(result.email).to.equal('test@test.com');
    });
    it('Generates an Objection error when it updates a user with PATCH', async () => {

        const config = getOptions({
            schwifty: {
                migrateOnStart: false,
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();
        server.route({
            method: 'PATCH',
            path: '/users/{id}',
            config: {
                description: 'Update user',
                validate: {
                    payload: {
                        email: Joi.string().email()
                    },
                    params: {
                        id: Joi.number().integer().required()
                    }
                },
                auth: false
            },
            handler: { tandy: {} }
        });

        const options = {
            method: 'PATCH',
            url: '/users/1',
            payload: {
                email: 'test@test.com'
            }
        };

        const response = await server.inject(options);
        expect(response.statusCode).to.equal(500);
    });
    it('Updates a nonexistent user with PATCH', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'PATCH',
            path: '/users/{id}',
            config: {
                description: 'Update user',
                validate: {
                    payload: {
                        email: Joi.string().email(),
                        password: Joi.string(),
                        firstName: Joi.string(),
                        lastName: Joi.string()
                    },
                    params: {
                        id: Joi.number().integer().required()
                    }
                },
                auth: false
            },
            handler: { tandy: {} }
        });

        const options = {
            method: 'PATCH',
            url: '/users/99999',
            payload: {
                email: 'test@test.com'
            }
        };
        const response = await server.inject(options);
        expect(response.statusCode).to.equal(404);
    });
    it('Updates a user with PATCH and bad query', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });
        const server = await getServer(config);
        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'PATCH',
            path: '/users/{id}',
            config: {
                description: 'Update user',
                validate: {
                    payload: {
                        email: Joi.string().email(),
                        password: Joi.string(),
                        firstName: Joi.string(),
                        lastName: Joi.string()
                    },
                    params: {
                        id: Joi.number().integer().required()
                    }
                },
                auth: false
            },
            handler: { tandy: {} }
        });

        const options = {
            method: 'PATCH',
            url: '/users/-22',
            payload: {
                email: 'test@test.com'
            }
        };

        const response = await server.inject(options);
        expect(response.statusCode).to.equal(404);
    });
    it('Creates a bad Tandy patern', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        try {
            server.route({
                method: 'POST',
                path: '/{id}/user',
                config: {
                    description: 'Update user',
                    validate: {
                        payload: {
                            email: Joi.string().email(),
                            password: Joi.string(),
                            firstName: Joi.string(),
                            lastName: Joi.string()
                        },
                        params: {
                            id: Joi.number().integer().required()
                        }
                    },
                    auth: false
                },
                handler: { tandy: {} }
            });
        }
        catch (err) {
            expect(err).to.be.an.error();
            expect(err).to.be.an.error('Unable to determine model for route /{id}/user');
        }
    });
    it('Creates a bad Tandy patern with GET', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        try {
            server.route({
                method: 'GET',
                path: '/users/token/firetruck',
                config: {
                    description: 'Bad pattern',
                    auth: false
                },
                handler: { tandy: {} }
            });
        }
        catch (err) {
            expect(err).to.be.an.error();
            expect(err).to.be.an.error('This get route does not match a Tandy pattern.');
        }
    });
    it('Creates a bad Tandy patern with GET', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        try {
            server.route({
                method: 'GET',
                path: '/users/token/{id}/firetruck',
                config: {
                    description: 'Bad pattern',
                    auth: false
                },
                handler: { tandy: {} }
            });
        }
        catch (err) {
            expect(err).to.be.an.error();
            expect(err).to.be.an.error('This get route does not match a Tandy pattern.');
        }
    });
    it('Creates a bad Tandy patern with DELETE', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);

        await server.initialize();
        const knex = server.knex();
        // const data = await knex.seed.run({ directory: 'test/seeds' });
        await knex.seed.run({ directory: 'test/seeds' });
        try {
            server.route({
                method: 'DELETE',
                path: '/users/token/{id}/firetruck',
                config: {
                    description: 'Bad pattern',
                    auth: false
                },
                handler: { tandy: {} }
            });
        }
        catch (err) {
            expect(err).to.be.an.error();
            expect(err).to.be.an.error('This delete route does not match a Tandy pattern.');
        }
    });
    it('Creates a bad Tandy patern with DELETE', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);

        await server.initialize();
        const knex = server.knex();
        // const data = await knex.seed.run({ directory: 'test/seeds' });
        await knex.seed.run({ directory: 'test/seeds' });

        try {
            server.route({
                method: 'DELETE',
                path: '/users/token/{id}',
                config: {
                    description: 'Bad pattern',
                    auth: false
                },
                handler: { tandy: {} }
            });
        }
        catch (err) {
            expect(err).to.be.an.error();
            expect(err).to.be.an.error('This delete route does not match a Tandy pattern.');
        }
    });
    it('Creates a bad Tandy patern with OPTIONS', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);

        await server.initialize();
        const knex = server.knex();
        // const data = await knex.seed.run({ directory: 'test/seeds' });
        await knex.seed.run({ directory: 'test/seeds' });

        try {
            server.route({
                method: 'OPTIONS',
                path: '/users',
                config: {
                    description: 'Bad pattern',
                    auth: false
                },
                handler: { tandy: {} }
            });
        }
        catch (err) {
            expect(err).to.be.an.error();
            expect(err).to.be.an.error('Method isn\'t a Tandy.  Must be POST, GET, DELETE, PUT, or PATCH.');
        }
    });
    it('Creates a bad Tandy patern with PATCH', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        try {
            server.route({
                method: 'PATCH',
                path: '/users/{id}/token/firetruck',
                config: {
                    description: 'Update user',
                    validate: {
                        payload: {
                            email: Joi.string().email(),
                            password: Joi.string(),
                            firstName: Joi.string(),
                            lastName: Joi.string()
                        },
                        params: {
                            id: Joi.number().integer().required()
                        }
                    },
                    auth: false
                },
                handler: { tandy: {} }
            });
        }
        catch (err) {
            expect(err).to.be.an.error();
            expect(err).to.be.an.error('This patch route does not match a Tandy pattern.');
        }
    });
    it('Creates a bad Tandy patern with PUT and wrong number params', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });
        const server = await getServer(config);

        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        try {
            server.route({
                method: 'PUT',
                path: '/users/{id}/token/firetruck',
                config: {
                    description: 'Update user',
                    validate: {
                        payload: {
                            email: Joi.string().email(),
                            password: Joi.string(),
                            firstName: Joi.string(),
                            lastName: Joi.string()
                        },
                        params: {
                            id: Joi.number().integer().required()
                        }
                    },
                    auth: false
                },
                handler: { tandy: {} }
            });
        }
        catch (err) {
            expect(err).to.be.an.error();
            expect(err).to.be.an.error('This put route does not match a Tandy pattern.');
        }
    });
    it('Creates a bad Tandy patern with PUT', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });
        const server = await getServer(config);

        await server.initialize();
        const knex = server.knex();
        // const data = await knex.seed.run({ directory: 'test/seeds' });
        await knex.seed.run({ directory: 'test/seeds' });

        try {
            server.route({
                method: 'PUT',
                path: '/users/{id}/{youd}',
                config: {
                    description: 'Update user',
                    validate: {
                        payload: {
                            email: Joi.string().email(),
                            password: Joi.string(),
                            firstName: Joi.string(),
                            lastName: Joi.string()
                        },
                        params: {
                            id: Joi.number().integer().required()
                        }
                    },
                    auth: false
                },
                handler: { tandy: {} }
            });
        }
        catch (err) {

            expect(err).to.be.an.error();
            expect(err).to.be.an.error('This put route does not match a Tandy pattern.');

        }
    });
    it('Creates a bad Tandy patern with POST', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });
        const server = await getServer(config);

        await server.initialize();
        const knex = server.knex();

        await knex.seed.run({ directory: 'test/seeds' });

        try {
            server.route({
                method: ['POST', 'PATCH'],
                path: '/user/{id}/token/firetruck',
                config: {
                    description: 'Update user',
                    validate: {
                        payload: {
                            email: Joi.string().email(),
                            password: Joi.string(),
                            firstName: Joi.string(),
                            lastName: Joi.string()
                        },
                        params: {
                            id: Joi.number().integer().required()
                        }
                    },
                    auth: false
                },
                handler: { tandy: {} }
            });
        }
        catch (err) {

            // expect(err).to.be.an.error();
            expect(err).to.be.an.error('This post route does not match a Tandy pattern.');

        }
    });
    it('Updates a user with POST', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });
        const server = await getServer(config);

        await server.initialize();
        const knex = server.knex();
        // const data = await knex.seed.run({ directory: 'test/seeds' });
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'POST',
            path: '/users/{id}',
            config: {
                description: 'Update user',
                validate: {
                    payload: {
                        email: Joi.string().email(),
                        password: Joi.string(),
                        firstName: Joi.string(),
                        lastName: Joi.string()
                    },
                    params: {
                        id: Joi.number().integer().required()
                    }
                },
                auth: false
            },
            handler: { tandy: {} }
        });

        const options = {
            method: 'POST',
            url: '/users/1',
            payload: {
                email: 'test@test.com'
            }
        };

        const response = await server.inject(options);

        const result = response.result;
        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.object();
        expect(result.email).to.equal('test@test.com');
    });
    it('Fetches all tokens, ensuring we handle lowercase model classnames', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);

        await server.initialize();
        const knex = server.knex();

        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/foobar',
            handler: { tandy: {
                model: 'tokens'
            } }
        });

        const options = {
            method: 'GET',
            url: '/foobar'
        };

        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.array();
        expect(result.length).to.equal(3);
    });
    it('Tries to use count too early in route path', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);

        await server.initialize();
        const knex = server.knex();

        await knex.seed.run({ directory: 'test/seeds' });
        try {
            server.route({
                method: 'GET',
                path: '/count/tokens',
                handler: { tandy: {
                    model: 'tokens'
                } }
            });
        }
        catch (e) {
            expect(e).to.exist();
            expect(e).to.be.an.error('Count can only appear at the end of a route path');

        }
    });
    it('Fetches all users', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });
        const server = await getServer(config);

        await server.initialize();
        const knex = server.knex();
        // const data = await knex.seed.run({ directory: 'test/seeds' });
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users'
        };

        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.array();
        expect(result.length).to.equal(4);
    });
    it('Fetches all users without actAsUser', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            },
            tandy: {
                actAsUser: false
            }
        });

        const server = await getServer(config);
        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users'
        };

        const response = await server.inject(options);

        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.array();
        expect(result.length).to.equal(4);
    });
    it('Fetches all users without userUrlPrefix', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            },
            tandy: {
                userUrlPrefix: false
            }
        });
        const server = await getServer(config);
        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users'
        };

        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.array();
        expect(result.length).to.equal(4);
    });

    it('Fetches all users without userModel', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            },
            tandy: {
                userModel: false
            }
        });
        const server = await getServer(config);

        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users'
        };

        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.array();
        expect(result.length).to.equal(4);
    });
    it('Generates an Objection error when GETting', async () => {

        const Model = require('schwifty').Model;

        const Users = class users extends Model {

            static get tableName() {

                return 'foo';
            }
        };

        const config = getOptions({
            migrateOnStart: false,
            schwifty: {
                models: [Users]
            }
        });

        const server = await getServer(config);

        await server.initialize();

        server.route({
            method: 'GET',
            path: '/users',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users'
        };

        const response = await server.inject(options);
        expect(response.statusCode).to.equal(500);
    });
    it('Generates an Objection error when GETting a count', async () => {

        const Model = require('schwifty').Model;

        const Users = class users extends Model {

            static get tableName() {

                return 'foo';
            }
        };
        const config = getOptions({
            migrateOnStart: false,
            schwifty: {
                models: [Users]
            }
        });
        const server = await getServer(config);

        await server.initialize();

        server.route({
            method: 'GET',
            path: '/users/count',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users/count'
        };

        const response = await server.inject(options);
        expect(response.statusCode).to.equal(500);
    });
    it('Fetches count of users', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });
        const server = await getServer(config);
        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users/count',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users/count'
        };

        const response = await server.inject(options);

        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result).to.be.a.number();
        expect(result).to.equal(4);
    });
    it('Fetches count of tokens for user', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users/{id}/tokens/count',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users/1/tokens/count'
        };

        const response = await server.inject(options);

        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result).to.be.a.number();
        expect(result).to.equal(2);
    });
    it('Fetches all users with a different route, using `model`', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/foobar',
            handler: { tandy: {
                model: 'users'
            } }
        });

        const options = {
            method: 'GET',
            url: '/foobar'
        };

        const response = await server.inject(options);

        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.array();
        expect(result.length).to.equal(4);
    });
    it('Fetches all users, sorted by email', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users',
            handler: { tandy: {
                sort: 'email'
            } }
        });

        const options = {
            method: 'GET',
            url: '/users'
        };

        const response = await server.inject(options);

        const result = response.result;
        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.array();
        expect(result.length).to.equal(4);
        //this one's ID would cause it to be in a different spot if sort failed
        expect(result[2].email).to.equal('c@d.e');
    });
    it('Fetches limited number of users', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users',
            handler: { tandy: { limit: 1 } },
            config: {
                validate: {
                    query: {
                        sort: Joi.string().required()
                    }
                }
            }
        });

        const options = {
            method: 'GET',
            url: '/users?sort=id'
        };

        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.array();
        expect(result.length).to.equal(1);
    });
    it('Fetches limited number of tokens for a user', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users/{id}/tokens',
            handler: { tandy: { limit: 1 } }
        });

        const options = {
            method: 'GET',
            url: '/users/1/tokens'
        };

        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result.tokens).to.be.an.array();
        expect(result.tokens.length).to.equal(1);
    });
    it('Fetches limited number of tokens for a user using query param', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users/{id}/tokens',
            config: {
                validate: {
                    query: {
                        limit: Joi.number().integer()
                    }
                }
            },
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users/1/tokens?limit=-1'
        };

        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result.tokens).to.be.an.array();
        expect(result.tokens.length).to.equal(1);
    });
    it('Fetches users, but skips first one', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });
        server.route({
            method: 'GET',
            path: '/users',
            handler: { tandy: { skip: 1 } }
        });

        const options = {
            method: 'GET',
            url: '/users'
        };
        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.array();
        expect(result.length).to.equal(3);
    });
    it('Fetches users, but skips first one using query param', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users',
            config: {
                validate: {
                    query: {
                        skip: Joi.number().integer()
                    }
                }
            },
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users?skip=1'
        };

        const response = await server.inject(options);
        const result = response.result;
        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.array();
        expect(result.length).to.equal(3);
    });
    it('Fetches users, but skips all of them and gets none', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users',
            config: {
                validate: {
                    query: {
                        skip: Joi.number().integer()
                    }
                }
            },
            handler: { tandy: { skip: 1 } }
        });

        const options = {
            method: 'GET',
            url: '/users?skip=1000'
        };
        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.array();
        expect(result.length).to.equal(0);
    });
    it('Fetches users and gets none', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        server.route({
            method: 'GET',
            path: '/users',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users'
        };
        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.array();
        expect(result.length).to.equal(0);
    });
    it('Sets invalid userModel', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        try {
            server.route({
                method: 'GET',
                path: '/users',
                handler: { tandy: { userModel: 1 } }
            });
        }
        catch (e) {
            expect(e).to.exist();
            expect(e).to.be.an.error('Option userModel should only have a string or a falsy value.');

        }
    });
    it('Sets invalid userUrlPrefix', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        try {
            server.route({
                method: 'GET',
                path: '/users',
                handler: { tandy: { userUrlPrefix: 1 } }
            });
        }
        catch (e) {
            expect(e).to.exist();
            expect(e).to.be.an.error('Option userUrlPrefix should only have a string or a falsy value.');
        }
    });
    it('Fetches more than default limit number of users using query param', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users',
            handler: {
                tandy: {
                    limit: 3
                }
            }
        });

        const options = {
            method: 'GET',
            url: '/users?limit=5'
        };
        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.array();
        expect(result.length).to.equal(4);
    });
    it('Fetches current user', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });
        server.route({
            method: 'GET',
            path: '/user',
            config: {
                auth: { strategy: 'mine' }
            },
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/user',
            headers: { authorization : 'dontcare' }
        };
        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.object();
        expect(result.id).to.equal(1);
    });
    it('Fetches current user with tokens', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });
        server.route({
            method: 'GET',
            path: '/user/tokens',
            config: {
                auth: { strategy: 'mine' }
            },
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/user/tokens',
            headers: { authorization : 'dontcare' }
        };
        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.object();
        expect(result.id).to.equal(1);
    });
    it('Fetches current user with bad credentials', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/user',
            config: {
                auth: { strategy: 'mine' }
            },
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/user',
            headers: { authorization : 'dontFOOcare' }
        };

        const response = await server.inject(options);
        expect(response.statusCode).to.equal(401);
    });
    it('Fetches current user without credentials', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/user',
            config: {
                auth: { strategy: 'mine' }
            },
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/user'
        };
        const response = await server.inject(options);
        expect(response.statusCode).to.equal(401);
    });
    it('Causes an Objection error with GET', async () => {

        const config = getOptions({
            schwifty: {
                migrateOnStart: false,//don't set up the db and don't seed it, Objection will choke
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        server.route({
            method: 'GET',
            path: '/users/{id}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users/1'
        };
        const response = await server.inject(options);
        expect(response.statusCode).to.equal(500);
    });
    it('Fetches a specific user', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users/{id}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users/1'
        };
        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result).to.be.an.object();
        expect(result.email).to.equal('a@b.c');
    });
    it('Fetches a nonexstent user', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users/{id}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users/9999'
        };
        const response = await server.inject(options);

        expect(response.statusCode).to.equal(404);
    });
    it('Fetches a specific user with tokens', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users/{id}/tokens',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users/1/tokens'
        };
        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result.tokens).to.be.an.array();
        expect(result.tokens.length).to.equal(2);
    });
    it('Generates an Objection error when populating', async () => {

        const config = getOptions({
            schwifty: {
                migrateOnStart: false,
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        server.route({
            method: 'GET',
            path: '/users/{id}/tokens',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users/1/tokens'
        };
        const response = await server.inject(options);

        expect(response.statusCode).to.equal(500);
    });
    it('Checks if a token is associated with a user', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users/{id}/tokens/{tokenId}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users/1/tokens/98'
        };
        const response = await server.inject(options);

        expect(response.statusCode).to.equal(204);
    });
    it('Sets up a too long route', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        try {
            server.route({
                method: 'GET',
                path: '/users/{id}/tokens/{tokenId}/firetruck/{truck}',
                handler: { tandy: {} }
            });
        }
        catch (e) {
            expect(e).to.exist();
            expect(e).to.be.an.error('Number of path segments should be between 1 and 4.');

        }
    });
    it('Checks if a token is associated with a user, fails', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });
        server.route({
            method: 'GET',
            path: '/users/{id}/tokens/{tokenId}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users/1/tokens/97'
        };
        const response = await server.inject(options);
        expect(response.statusCode).to.equal(404);
    });
    it('Fetches a specific user with tokens using different name and `associationAttr`', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users/{id}/foobar',
            handler: { tandy: {
                associationAttr: 'tokens'
            } }
        });

        const options = {
            method: 'GET',
            url: '/users/1/foobar'
        };
        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result.tokens).to.be.an.array();
        expect(result.tokens.length).to.equal(2);
    });
    it('Leaves `associationAttr` null', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });
        server.route({
            method: 'GET',
            path: '/users/{id}/foobar',
            handler: { tandy: {
                associationAttr: null
            } }
        });

        const options = {
            method: 'GET',
            url: '/users/1/foobar'
        };

        const response = await server.inject(options);
        expect(response.statusCode).to.equal(500);
    });
    it('Sets `associationAttr` to an invalid value', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });
        server.route({
            method: 'GET',
            path: '/users/{id}/foobar',
            handler: { tandy: {
                associationAttr: []
            } }
        });

        const options = {
            method: 'GET',
            url: '/users/1/foobar'
        };
        const response = await server.inject(options);

        expect(response.statusCode).to.equal(500);
    });
    it('Fetches a nonexstent user with tokens', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'GET',
            path: '/users/{id}/tokens',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users/000000/tokens'
        };
        const response = await server.inject(options);
        expect(response.statusCode).to.equal(404);
    });
    it('Fetches a specific user with empty tokens array', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });
        server.route({
            method: 'GET',
            path: '/users/{id}/tokens',
            handler: { tandy: {} }
        });

        const options = {
            method: 'GET',
            url: '/users/2/tokens'
        };
        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(200);
        expect(result.tokens).to.be.an.array();
        expect(result.tokens.length).to.equal(0);
    });
    it('Adds a token to a user with PUT', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'PUT',
            path: '/users/{id}/tokens/{tokenId}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'PUT',
            url: '/users/1/tokens/97'
        };
        const response = await server.inject(options);
        expect(response.statusCode).to.equal(204);
    });
    it('Creates Objection error with PUT', async () => {

        const config = getOptions({
            schwifty: {
                migrateOnStart: false,
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        server.route({
            method: 'PUT',
            path: '/users/{id}/tokens/{tokenId}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'PUT',
            url: '/users/1/tokens/97'
        };
        const response = await server.inject(options);
        expect(response.statusCode).to.equal(500);
    });
    it('Creates Objection error on relate with PUT', async () => {

        const config = getOptions({
            schwifty: {
                migrationsDir: 'test/bad_migrations',
                models: [TestModels.Users]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/bad_seeds' });
        server.route({
            method: 'PUT',
            path: '/users/{id}/tokens/{tokenId}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'PUT',
            url: '/users/1/tokens/97'
        };

        const response = await server.inject(options);
        expect(response.statusCode).to.equal(500);
    });
    it('Creates a new token and adds to user', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'POST',
            path: '/users/{id}/tokens',
            config: {
                description: 'Adds a new token to a user',
                validate: {
                    payload: {
                        temp: Joi.string()
                    },
                    params: {
                        id: Joi.number().integer().required()
                    }
                },
                auth: false
            },
            handler: { tandy: {} }
        });

        const options = {
            method: 'POST',
            url: '/users/1/tokens',
            payload: {
                temp: 'this is just a string'
            }
        };
        const response = await server.inject(options);

        expect(response.statusCode).to.equal(201);
        expect(response.result).to.be.an.object();
        expect(response.result.user).to.equal(1);
    });
    it('Creates an objection error with relate/post', async () => {

        const config = getOptions({
            schwifty: {
                migrationsDir: 'test/bad_migrations',
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/bad_seeds' });

        server.route({
            method: 'POST',
            path: '/users/{id}/tokens',
            config: {
                description: 'Adds a new token to a user',
                validate: {
                    payload: {
                        temp: Joi.string()
                    },
                    params: {
                        id: Joi.number().integer().required()
                    }
                },
                auth: false
            },
            handler: { tandy: {} }
        });

        const options = {
            method: 'POST',
            url: '/users/1/tokens',
            payload: {
                temp: 'this is just a string'
            }
        };
        const response = await server.inject(options);
        expect(response.statusCode).to.equal(500);
    });
    it('Adds a token to a nonexistent user', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        server.route({
            method: 'PUT',
            path: '/users/{id}/tokens/{tokenId}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'PUT',
            url: '/users/9999/tokens/97'
        };
        const response = await server.inject(options);
        expect(response.statusCode).to.equal(404);
    });
    it('Adds a nonexistent token to a user', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });
        server.route({
            method: 'PUT',
            path: '/users/{id}/tokens/{tokenId}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'PUT',
            url: '/users/1/tokens/999997'
        };
        const response = await server.inject(options);
        expect(response.statusCode).to.equal(404);
    });
    it('Removes a token from a user', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'DELETE',
            path: '/users/{id}/tokens/{tokenId}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'DELETE',
            url: '/users/1/tokens/98'
        };
        const response = await server.inject(options);

        expect(response.statusCode).to.equal(204);
    });
    it('Generates an Objection error when removing a token from a user', async () => {

        const config = getOptions({
            schwifty: {
                migrateOnStart: false,
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        server.route({
            method: 'DELETE',
            path: '/users/{id}/tokens/{tokenId}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'DELETE',
            url: '/users/1/tokens/98'
        };
        const response = await server.inject(options);
        expect(response.statusCode).to.equal(500);
    });
    it('Generates an Objection error when removing an existing token from a user', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'DELETE',
            path: '/users/{id}/tokens/{tokenId}',
            handler: { tandy: {} }
        });
        await knex.schema.dropTable('tokens');

        const options = {
            method: 'DELETE',
            url: '/users/1/tokens/98'
        };
        const response = await server.inject(options);
        expect(response.statusCode).to.equal(500);
    });
    it('Removes a token from a nonexistent user', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'DELETE',
            path: '/users/{id}/tokens/{tokenId}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'DELETE',
            url: '/users/99999/tokens/98'
        };
        const response = await server.inject(options);
        expect(response.statusCode).to.equal(404);
    });
    it('Removes a nonexistent token from a user', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'DELETE',
            path: '/users/{id}/tokens/{tokenId}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'DELETE',
            url: '/users/1/tokens/999998'
        };
        const response = await server.inject(options);
        expect(response.statusCode).to.equal(404);
    });
    it('Sets up a count on a non count route', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        try {
            server.route({
                method: 'DELETE',
                path: '/users/count',
                handler: { tandy: {} }
            });
        }
        catch (e) {
            expect(e).to.exist();
        }
    });
    it('Deletes a specific user', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'DELETE',
            path: '/users/{id}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'DELETE',
            url: '/users/1'
        };
        const response = await server.inject(options);
        const result = response.result;

        expect(response.statusCode).to.equal(204);
        expect(result).to.be.null();
    });
    it('Generates an Objection error when deleting a nonexistent model ', async () => {

        const config = getOptions({
            schwifty: {
                migrateOnStart: false,
                models: [
                    TestModels.Users
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();

        server.route({
            method: 'DELETE',
            path: '/users/{id}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'DELETE',
            url: '/users/1'
        };
        const response = await server.inject(options);

        expect(response.statusCode).to.equal(500);
    });
    it('Deletes a nonexistent user', async () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        const server = await getServer(config);
        await server.initialize();
        const knex = server.knex();
        await knex.seed.run({ directory: 'test/seeds' });

        server.route({
            method: 'DELETE',
            path: '/users/{id}',
            handler: { tandy: {} }
        });

        const options = {
            method: 'DELETE',
            url: '/users/99999'
        };
        const response = await server.inject(options);

        expect(response.statusCode).to.equal(404);
    });
});
