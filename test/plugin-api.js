'use strict';

exports.register = function (server, options, next) {

    server.route({
        method: 'GET',
        path: '/users',
        handler: { tandy: {} }
    });

    next();
};

exports.register.attributes = {
    name: 'myPlugin',
    version: '1.0.0'
};
