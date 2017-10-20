'use strict';

// Load modules

const Lab = require('lab');
const Code = require('code');
const Hapi = require('hapi');
const Joi = require('joi');
const Hoek = require('hoek');
const Boom = require('boom');

const Schwifty = require('schwifty');
const Tandy = require('..');
const TestModels = require('./models');

// Test shortcuts
const lab = exports.lab = Lab.script();
const expect = Code.expect;
const fail = Code.fail;
const describe = lab.describe;
const before = lab.before;
const it = lab.it;

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
            authenticate: (request, reply) => {

                const req = request.raw.req;
                const authorization = req.headers.authorization;

                if (!authorization || authorization !== 'dontcare') {
                    return reply(Boom.unauthorized(null, 'Custom'));
                }

                return reply.continue({ credentials: { user: { id: 1 } } });
            }
        };
    };

    const getServer = (options, cb) => {

        const server = new Hapi.Server();
        server.connection();

        server.auth.scheme('custom', scheme);
        server.auth.strategy('mine', 'custom');

        server.register([
            {
                register: Schwifty,
                options: options.schwifty
            },
            {
                register: Tandy,
                options: options.tandy
            }
        ], (err) => {

            if (err) {
                return cb(err);
            }
            return cb(null, server);
        });
    };

    before((done) => {

        require('sqlite3'); // Just warm-up sqlite, so that the tests have consistent timing
        done();
    });

    it('Creates a new user', (done) => {

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

                if (err) {
                    return done(err);
                }
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

                server.inject(options, (response) => {

                    const result = response.result;

                    expect(response.statusCode).to.equal(201);
                    expect(result).to.be.an.object();
                    expect(result.email).to.equal('test@test.com');
                    done();
                });
            });
        });
    });
    it('Generates an Objection error when creating a new token', (done) => {

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

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.initialize((err) => {

                if (err) {
                    return done(err);
                }
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

                server.inject(options, (response) => {

                    expect(response.statusCode).to.equal(500);
                    done();
                });
            });
        });
    });
    it('Updates a user with PATCH', (done) => {

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

                if (err) {
                    return done(err);
                }
                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

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

                    server.inject(options, (response) => {

                        const result = response.result;
                        expect(response.statusCode).to.equal(200);
                        expect(result).to.be.an.object();
                        expect(result.email).to.equal('test@test.com');
                        done();
                    });
                });
            });
        });
    });
    it('Generates an Objection error when it updates a user with PATCH', (done) => {

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

                server.inject(options, (response) => {

                    expect(response.statusCode).to.equal(500);
                    done();
                });
            });
        });
    });
    it('Updates a nonexistent user with PATCH', (done) => {

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

                if (err) {
                    return done(err);
                }
                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

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

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(404);
                        done();
                    });
                });
            });
        });
    });
    it('Updates a user with PATCH and bad query', (done) => {

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

                if (err) {
                    return done(err);
                }
                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

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

                    server.inject(options, (response) => {

                        expect(response.statusCode).to.equal(404);
                        done();
                    });
                });
            });
        });
    });
    it('Creates a bad Tandy patern', (done) => {

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

                if (err) {
                    return done(err);
                }
                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

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
                        done();
                    }
                });
            });
        });
    });
    it('Creates a bad Tandy patern with GET', (done) => {

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

                if (err) {
                    return done(err);
                }
                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

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
                        done();
                    }
                });
            });
        });
    });
    it('Creates a bad Tandy patern with GET', (done) => {

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

                if (err) {
                    return done(err);
                }
                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

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
                        done();
                    }
                });
            });
        });
    });
    it('Creates a bad Tandy patern with DELETE', (done) => {

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

                if (err) {
                    return done(err);
                }
                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

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
                        done();
                    }
                });
            });
        });
    });
    it('Creates a bad Tandy patern with DELETE', (done) => {

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

                if (err) {
                    return done(err);
                }
                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

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
                        done();
                    }
                });
            });
        });
    });
    it('Creates a bad Tandy patern with OPTIONS', (done) => {

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

                if (err) {
                    return done(err);
                }
                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

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
                        done();
                    }
                });
            });
        });
    });
    it('Creates a bad Tandy patern with PATCH', (done) => {

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

                if (err) {
                    return done(err);
                }
                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

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
                        done();
                    }
                });
            });
        });
    });
    it('Creates a bad Tandy patern with PUT and wrong number params', (done) => {

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

                if (err) {
                    return done(err);
                }
                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

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
                        done();
                    }
                });
            });
        });
    });
    it('Creates a bad Tandy patern with PUT', (done) => {

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

                if (err) {
                    return done(err);
                }
                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

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
                        done();
                    }
                });
            });
        });
    });
    it('Creates a bad Tandy patern with POST', (done) => {

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

                if (err) {
                    return done(err);
                }
                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

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
                        done();
                    }
                });
            });
        });
    });
    it('Updates a user with POST', (done) => {

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

                if (err) {
                    return done(err);
                }
                const knex = server.knex();
                knex.seed.run({ directory: 'test/seeds' }).then((data) => {

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

                    server.inject(options, (response) => {

                        const result = response.result;
                        expect(response.statusCode).to.equal(200);
                        expect(result).to.be.an.object();
                        expect(result.email).to.equal('test@test.com');
                        done();
                    });
                });
            });
        });
    });
    it('Fetches all tokens, ensuring we handle lowercase model classnames', (done) => {

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
                            model: 'tokens'
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
                        expect(result.length).to.equal(3);
                        done();
                    });
                });

            });
        });
    });
    it('Fetches all users', (done) => {

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
                        handler: { tandy: {} }
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
                        done();
                    });
                });

            });
        });
    });
    it('Fetches all users without actAsUser', (done) => {

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
                        handler: { tandy: {} }
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
                        done();
                    });
                });

            });
        });
    });
    it('Fetches all users without userUrlPrefix', (done) => {

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
                        handler: { tandy: {} }
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
                        done();
                    });
                });

            });
        });
    });
    it('Fetches all users after stripping route prefix', (done) => {

        const config = getOptions({
            schwifty: {
                models: [
                    TestModels.Users,
                    TestModels.Tokens
                ]
            },
            tandy: {
                prefix: '/api'
            }
        });

        getServer(config, (err, server) => {

            if (err) {
                return done(err);
            }
            server.register({ register: require('./plugin-api') }, {

                routes: {
                    prefix: '/api'
                }
            }, (err) => {

                if (err) {
                    throw err;
                }

                server.initialize((err) => {

                    const knex = server.knex();
                    knex.seed.run({ directory: 'test/seeds' }).then((data) => {

                        if (err) {
                            return done(err);
                        }

                        const options = {
                            method: 'GET',
                            url: '/api/users'
                        };

                        server.inject(options, (response) => {

                            const result = response.result;

                            expect(response.statusCode).to.equal(200);
                            expect(result).to.be.an.array();
                            expect(result.length).to.equal(4);
                            done();
                        });
                    });

                });
            });
        });
    });
    it('Forgets to set the route prefix up', (done) => {

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
            try {
                server.register({ register: require('./plugin-api') }, {

                    routes: {
                        prefix: '/api'
                    }
                }, (err) => {

                    if (err) {
                        throw err;
                    }
                    fail();
                });
            }
            catch (err) {
                expect(err).to.be.an.error();
                expect(err).to.be.an.error('Model `api` must exist to build route.');
                done();
            }
        });
    });
    it('Fetches all users without userModel', (done) => {

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
                        handler: { tandy: {} }
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
                        done();
                    });
                });

            });
        });
    });
    it('Generates an Objection error when GETting', (done) => {

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
                    path: '/users',
                    handler: { tandy: {} }
                });

                const options = {
                    method: 'GET',
                    url: '/users'
                };

                server.inject(options, (response) => {

                    expect(response.statusCode).to.equal(500);
                    done();
                });
            });
        });
    });
    it('Generates an Objection error when GETting a count', (done) => {

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
                    path: '/users/count',
                    handler: { tandy: {} }
                });

                const options = {
                    method: 'GET',
                    url: '/users/count'
                };

                server.inject(options, (response) => {

                    expect(response.statusCode).to.equal(500);
                    done();
                });
            });
        });
    });
    it('Fetches count of users', (done) => {

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
                        path: '/users/count',
                        handler: { tandy: {} }
                    });

                    const options = {
                        method: 'GET',
                        url: '/users/count'
                    };

                    server.inject(options, (response) => {

                        const result = response.result;

                        expect(response.statusCode).to.equal(200);
                        expect(result).to.be.a.number();
                        expect(result).to.equal(4);
                        done();
                    });
                });
            });
        });
    });
    it('Fetches count of tokens for user', (done) => {

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
                        done();
                    });
                });

            });
        });
    });
    it('Fetches all users with a different route, using `model`', (done) => {

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
                        done();
                    });
                });

            });
        });
    });
    it('Fetches all users, sorted by email', (done) => {

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
                        done();
                    });
                });

            });
        });
    });
    it('Fetches limited number of users', (done) => {

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
                        done();
                    });
                });

            });
        });
    });
    it('Fetches limited number of tokens for a user', (done) => {

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
                        done();
                    });
                });

            });
        });
    });
    it('Fetches limited number of tokens for a user using query param', (done) => {

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
                        done();
                    });
                });

            });
        });
    });
    it('Fetches users, but skips first one', (done) => {

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
                        done();
                    });
                });

            });
        });
    });
    it('Fetches users, but skips first one using query param', (done) => {

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
                        done();
                    });
                });

            });
        });
    });
    it('Fetches users, but skips all of them and gets none', (done) => {

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
                        done();
                    });
                });
            });
        });
    });
    it('Sets invalid userModel', (done) => {

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
                        done();
                    }
                });
            });
        });
    });
    it('Sets invalid userUrlPrefix', (done) => {

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
                        done();
                    }
                });
            });
        });
    });
    it('Fetches more than default limit number of users using query param', (done) => {

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
                        done();
                    });
                });

            });
        });
    });
    it('Fetches current user', (done) => {

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
                        done();
                    });
                });

            });
        });
    });
    it('Fetches current user', (done) => {

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
                        done();
                    });
                });

            });
        });
    });
    it('Fetches current user with bad credentials', (done) => {

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
                        done();
                    });
                });

            });
        });
    });
    it('Fetches current user without credentials', (done) => {

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
                        done();
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
                    done();
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
                        done();
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
                        done();
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
                        done();
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
                    done();
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
                        done();
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
                        done();
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
                        done();
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
                        done();
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
                        done();
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
                        done();
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
                        done();
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
                        done();
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
                        done();
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
                    done();
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
                        done();
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
                        done();
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
                        done();
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
                        done();
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
                        done();
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
                        done();
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
                    done();
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
                            done();
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
                        done();
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
                        done();
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
                        done();
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
                        done();
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
                    done();
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
                        done();
                    });
                });
            });
        });
    });//*/
});
