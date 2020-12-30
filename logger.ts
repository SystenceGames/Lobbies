﻿import os = require("os");
let winston = require('winston');
import settings = require('./config/settings');

let logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            handleExceptions: true,
            json: false,
            padLevels: true,
            colorize: true
        })
    ],
    exitOnError: false
});
if (settings.useGraylog) {
    logger.add(require('winston-graylog2'), settings.Graylog2);
}

winston.handleExceptions(new winston.transports.Console({ colorize: true, json: true }));
winston.exitOnError = false;

logger.stream = {
    write: function (message: any, encoding: any) {
        if (!settings.logMorgan) {
            return;
        }
        let messageObject: any = JSON.parse(message);
        logger.info("InboundCall", messageObject);
    }
}

logger.info("initialized winston");

export = logger;