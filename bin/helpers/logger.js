const winston = require('winston');
const fs = require("fs");
const path = require("path");


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
    file: () => new winston.Logger({
        transports: [
            new winston.transports.File({
                filename: path.join(logDir, filename),
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
