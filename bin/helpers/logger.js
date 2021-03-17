const winston = require('winston');

module.exports = {

    console: () => new winston.Logger({
        transports: [
            new winston.transports.Console({
                name: 'console.info',
                colorize: true,
                timestamp: () => `[${new Date().toLocaleString()}]`,
                prettyPrint: true,
            }),
        ]
    }),
    sync: () => new winston.Logger({
        transports: [
            new (winston.transports.Console)({
                formatter: (options) => options.message ? options.message : '',
            }),
        ]
    }),
};
