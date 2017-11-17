'use strict';

// Load modules

const Lab = require('lab');
// const Code = require('code');
const Hapi = require('hapi');
const Joi = require('joi');
const Hoek = require('hoek');
const Boom = require('boom');

const Schwifty = require('schwifty');
const Tandy = require('..');
const TestModels = require('./models');

const { before, describe, expect, it } = exports.lab = Lab.script();

//TODO: https://github.com/hapijs/hapi/issues/3658
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
                userModel: 'users'
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

        const server = Hapi.Server();

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

        require('pg'); // Just warm-up sqlite, so that the tests have consistent timing

    });

    it.only('creates a new user', async () => {

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

        expect(res.statusCode).to.equal(200);
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
        // const result = response.result;
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
        // const data = await knex.seed.run({ directory: 'test/seeds' });
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
        // const data = await knex.seed.run({ directory: 'test/seeds' });
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
        // const data = await knex.seed.run({ directory: 'test/seeds' });
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
        // const data = await knex.seed.run({ directory: 'test/seeds' });
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
        // const data = await knex.seed.run({ directory: 'test/seeds' });
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
        // const data = await knex.seed.run({ directory: 'test/seeds' });
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
        // const data = await knex.seed.run({ directory: 'test/seeds' });
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
        // const data = await knex.seed.run({ directory: 'test/seeds' });
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

            expect(err).to.be.an.error();
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
        // const data = await knex.seed.run({ directory: 'test/seeds' });
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
    // it('Generates an Objection error when GETting', async () => {
    //
    //     const Model = require('schwifty').Model;
    //     const Users = class users extends Model {
    //
    //         static get tableName() {
    //
    //             return 'foo';
    //         }
    //     };
    //     const config = getOptions({
    //         migrateOnStart: false,
    //         schwifty: {
    //             models: [Users]
    //         }
    //     });
    //
    //     const server = await getServer(config);
    //
    //     await server.initialize();
    //     server.route({
    //         method: 'GET',
    //         path: '/users',
    //         handler: { tandy: {} }
    //     });
    //
    //     const options = {
    //         method: 'GET',
    //         url: '/users'
    //     };
    //
    //     // await expect(server.inject(options)).to.reject()
    //     try {
    //         const response = await server.inject(options);
    //     }
    //     catch (err) {
    //         expect(err).to.exist();
    //         // expect(response.statusCode).to.equal(500);
    //     }
    //     // const response = await server.inject(options);
    //     //
    //     // expect(response.statusCode).to.equal(500);
    // });
    // it('Generates an Objection error when GETting a count', async () => {
    //
    //     const Model = require('schwifty').Model;
    //     const Users = class users extends Model {
    //
    //         static get tableName() {
    //
    //             return 'foo';
    //         }
    //     };
    //     const config = getOptions({
    //         migrateOnStart: false,
    //         schwifty: {
    //             models: [Users]
    //         }
    //     });
    //     const server = await getServer(config);
    //
    //     await server.initialize();
    //
    //     server.route({
    //         method: 'GET',
    //         path: '/users/count',
    //         handler: { tandy: {} }
    //     });
    //
    //     const options = {
    //         method: 'GET',
    //         url: '/users/count'
    //     };
    //     // await expect(server.inject(options)).to.reject()
    //     try {
    //         const response = await server.inject(options);
    //     }
    //     catch (err) {
    //         expect(err).to.exist();
    //         // expect(response.statusCode).to.equal(500);
    //     }
    // });/*
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
        // const data = await knex.seed.run({ directory: 'test/seeds' });
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
/*    it('Fetches count of tokens for user', () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'GET',
                        path: '/users/{id}/tokens/count',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'GET',
                        url: '/users/1/tokens/count'
                    };

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result).to.be.a.number();
                        expect(result).to.equal(2);

                    });
                });

            });
        });
    });
    it('Fetches all users with a different route, using `model`', () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

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

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result).to.be.an.array();
                        expect(result.length).to.equal(4);

                    });
                });

            });
        });
    });
    it('Fetches all users, sorted by email', () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }
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

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result).to.be.an.array();
                        expect(result.length).to.equal(4);
                        //this one's ID would cause it to be in a different spot if sort failed
                        expect(result[2].email).to.equal('c@d.e');

                    });
                });

            });
        });
    });
    it('Fetches limited number of users', () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

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

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result).to.be.an.array();
                        expect(result.length).to.equal(1);

                    });
                });

            });
        });
    });
    it('Fetches limited number of tokens for a user', () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'GET',
                        path: '/users/{id}/tokens',
                        handler: { tandy: { limit: 1 } }
                    });

                    const options = {
                        method: 'GET',
                        url: '/users/1/tokens'
                    };

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result.tokens).to.be.an.array();
                        expect(result.tokens.length).to.equal(1);

                    });
                });

            });
        });
    });
    it('Fetches limited number of tokens for a user using query param', () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

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

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result.tokens).to.be.an.array();
                        expect(result.tokens.length).to.equal(1);

                    });
                });

            });
        });
    });
    it('Fetches users, but skips first one', () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'GET',
                        path: '/users',
                        handler: { tandy: { skip: 1 } }
                    });

                    const options = {
                        method: 'GET',
                        url: '/users'
                    };

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result).to.be.an.array();
                        expect(result.length).to.equal(3);

                    });
                });

            });
        });
    });
    it('Fetches users, but skips first one using query param', () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

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
                        url: '/users?skip=1'
                    };

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result).to.be.an.array();
                        expect(result.length).to.equal(3);

                    });
                });

            });
        });
    });
    it('Fetches users, but skips all of them and gets none', () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

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

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result).to.be.an.array();
                        expect(result.length).to.equal(0);

                    });
                });
            });
        });
    });
    it('Sets invalid userModel', () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }
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
            });
        });
    });
    it('Sets invalid userUrlPrefix', () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }
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
            });
        });
    });
    it('Fetches more than default limit number of users using query param', () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

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

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result).to.be.an.array();
                        expect(result.length).to.equal(4);

                    });
                });

            });
        });
    });
    it('Fetches current user', () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

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

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result).to.be.an.object();
                        expect(result.id).to.equal(1);

                    });
                });

            });
        });
    });
    it('Fetches current user', () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

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

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result).to.be.an.object();
                        expect(result.id).to.equal(1);

                    });
                });

            });
        });
    });
    it('Fetches current user with bad credentials', () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

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

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(401);

                    });
                });

            });
        });
    });
    it('Fetches current user without credentials', () => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

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

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(401);

                    });
                });

            });
        });
    });
    it('Causes an Objection error with GET', (done) => {

        const config = getOptions({
            schwifty: {
                migrateOnStart: false,//don't set up the db and don't seed it, Objection will choke
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                if (err) {
                    return done(err);
                }

                server.route({
                    method: 'GET',
                    path: '/users/{id}',
                    handler: { tandy: {} }
                });

                const options = {
                    method: 'GET',
                    url: '/users/1'
                };

                server.inject(options, (response) => {

                    expect(response.statusCode).to.equal(500);

                });
            });
        });
    });
    it('Fetches a specific user', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'GET',
                        path: '/users/{id}',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'GET',
                        url: '/users/1'
                    };

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result).to.be.an.object();
                        expect(result.email).to.equal('a@b.c');

                    });
                });
            });
        });
    });
    it('Fetches a nonexstent user', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'GET',
                        path: '/users/{id}',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'GET',
                        url: '/users/9999'
                    };

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(404);

                    });
                });
            });
        });
    });
    it('Fetches a specific user with tokens', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'GET',
                        path: '/users/{id}/tokens',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'GET',
                        url: '/users/1/tokens'
                    };

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result.tokens).to.be.an.array();
                        expect(result.tokens.length).to.equal(2);

                    });
                });
            });
        });
    });
    it('Generates an Objection error when populating', (done) => {

        const config = getOptions({
            schwifty: {
                migrateOnStart: false,
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                if (err) {
                    return done(err);
                }

                server.route({
                    method: 'GET',
                    path: '/users/{id}/tokens',
                    handler: { tandy: {} }
                });

                const options = {
                    method: 'GET',
                    url: '/users/1/tokens'
                };

                server.inject(options, (response) => {

                    expect(response.statusCode).to.equal(500);

                });
            });
        });
    });
    it('Checks if a token is associated with a user', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'GET',
                        path: '/users/{id}/tokens/{tokenId}',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'GET',
                        url: '/users/1/tokens/98'
                    };

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(204);

                    });
                });
            });
        });
    });
    it('Sets up a too long route', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }
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
            });
        });
    });
    it('Checks if a token is associated with a user, fails', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'GET',
                        path: '/users/{id}/tokens/{tokenId}',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'GET',
                        url: '/users/1/tokens/97'
                    };

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(404);

                    });
                });
            });
        });
    });
    it('Fetches a specific user with tokens using different name and `associationAttr`', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

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

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result.tokens).to.be.an.array();
                        expect(result.tokens.length).to.equal(2);

                    });
                });
            });
        });
    });
    it('Leaves `associationAttr` null', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

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

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(404);

                    });
                });
            });
        });
    });
    it('Sets `associationAttr` to an invalid value', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

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

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(404);

                    });
                });
            });
        });
    });
    it('Fetches a nonexstent user with tokens', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'GET',
                        path: '/users/{id}/tokens',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'GET',
                        url: '/users/000000/tokens'
                    };

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(404);

                    });
                });
            });
        });
    });
    it('Fetches a specific user with empty tokens array', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'GET',
                        path: '/users/{id}/tokens',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'GET',
                        url: '/users/2/tokens'
                    };

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result.tokens).to.be.an.array();
                        expect(result.tokens.length).to.equal(0);

                    });
                });
            });
        });
    });
    it('Adds a token to a user with PUT', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'PUT',
                        path: '/users/{id}/tokens/{tokenId}',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'PUT',
                        url: '/users/1/tokens/97'
                    };

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(204);

                    });
                });
            });
        });
    });
    it('Creates Objection error with PUT', (done) => {

        const config = getOptions({
            schwifty: {
                migrateOnStart: false,
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                if (err) {
                    return done(err);
                }

                server.route({
                    method: 'PUT',
                    path: '/users/{id}/tokens/{tokenId}',
                    handler: { tandy: {} }
                });

                const options = {
                    method: 'PUT',
                    url: '/users/1/tokens/97'
                };

                server.inject(options, (response) => {

                    expect(response.statusCode).to.equal(500);

                });
            });
        });
    });
    it('Creates Objection error on relate with PUT', (done) => {

        const config = getOptions({
            schwifty: {
                migrationsDir: 'test/bad_migrations',
                models: [TestModels.Users]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/bad_seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'PUT',
                        path: '/users/{id}/tokens/{tokenId}',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'PUT',
                        url: '/users/1/tokens/97'
                    };

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(500);

                    });
                });
            });
        });
    });
    it('Creates a new token and adds to user', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

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

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(201);
                        expect(response.result).to.be.an.object();
                        expect(response.result.user).to.equal(1);

                    });
                });
            });
        });
    });
    it('Creates an objection error with relate/post', (done) => {

        const config = getOptions({
            schwifty: {
                migrationsDir: 'test/bad_migrations',
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/bad_seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

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

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(500);

                    });
                });
            });
        });
    });
    it('Adds a token to a nonexistent user', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'PUT',
                        path: '/users/{id}/tokens/{tokenId}',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'PUT',
                        url: '/users/9999/tokens/97'
                    };

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(404);

                    });
                });
            });
        });
    });
    it('Adds a nonexistent token to a user', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'PUT',
                        path: '/users/{id}/tokens/{tokenId}',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'PUT',
                        url: '/users/1/tokens/999997'
                    };

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(404);

                    });
                });
            });
        });
    });
    it('Removes a token from a user', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'DELETE',
                        path: '/users/{id}/tokens/{tokenId}',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'DELETE',
                        url: '/users/1/tokens/98'
                    };

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(204);

                    });
                });
            });
        });
    });
    it('Generates an Objection error when removing a token from a user', (done) => {

        const config = getOptions({
            schwifty: {
                migrateOnStart: false,
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                if (err) {
                    return done(err);
                }

                server.route({
                    method: 'DELETE',
                    path: '/users/{id}/tokens/{tokenId}',
                    handler: { tandy: {} }
                });

                const options = {
                    method: 'DELETE',
                    url: '/users/1/tokens/98'
                };

                server.inject(options, (response) => {

                    expect(response.statusCode).to.equal(500);

                });
            });
        });
    });
    it('Generates an Objection error when removing an existing token from a user', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'DELETE',
                        path: '/users/{id}/tokens/{tokenId}',
                        handler: { tandy: {} }
                    });
                    knex.schema.dropTable('tokens').then(() => {

                        const options = {
                            method: 'DELETE',
                            url: '/users/1/tokens/98'
                        };

                        server.inject(options, (response) => {

                            expect(response.statusCode).to.equal(500);

                        });
                    });
                });
            });
        });
    });
    it('Removes a token from a nonexistent user', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'DELETE',
                        path: '/users/{id}/tokens/{tokenId}',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'DELETE',
                        url: '/users/99999/tokens/98'
                    };

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(404);

                    });
                });
            });
        });
    });
    it('Removes a nonexistent token from a user', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'DELETE',
                        path: '/users/{id}/tokens/{tokenId}',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'DELETE',
                        url: '/users/1/tokens/999998'
                    };

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(404);

                    });
                });
            });
        });
    });
    it('Sets up a count on a non count route', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }
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
            });
        });
    });
    it('Deletes a specific user', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'DELETE',
                        path: '/users/{id}',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'DELETE',
                        url: '/users/1'
                    };

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(204);
                        expect(result).to.be.null();

                    });
                });
            });
        });
    });
    it('Generates an Objection error when deleting a nonexistent model ', (done) => {

        const config = getOptions({
            schwifty: {
                migrateOnStart: false,
                models: [
                    TestModels.Users
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                if (err) {
                    return done(err);
                }

                server.route({
                    method: 'DELETE',
                    path: '/users/{id}',
                    handler: { tandy: {} }
                });

                const options = {
                    method: 'DELETE',
                    url: '/users/1'
                };

                server.inject(options, (response) => {

                    expect(response.statusCode).to.equal(500);

                });
            });
        });
    });
    it('Deletes a nonexistent user', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                    if (err) {
                        return done(err);
                    }

                    server.route({
                        method: 'DELETE',
                        path: '/users/{id}',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'DELETE',
                        url: '/users/99999'
                    };

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(404);

                    });
                });
            });
        });
    });//*/
});
