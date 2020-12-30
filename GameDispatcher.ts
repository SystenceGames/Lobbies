let GUID = require('node-uuid').v4;
import Q = require('q');
let amqp = require('amqplib');
import I = require('./Interfaces');
import EventBus = require('./EventBus');
import logger = require('./logger');
import settings = require('./config/settings');

let jobs: { [gameGUID: string]: I.Job; } = {};

EventBus.on("Start ProcessInfo", function (processInfo: I.ProcessInfo) {
    let jobID = GUID();
    let job: I.Job = {
        jobID: jobID,
        callbackURL: "http://" + settings.callbackBaseURL + ":" + settings.httpDirectPort + '/jobCallback/' + processInfo.gameGUID + '/' + jobID,
        processInfo: processInfo
    }
    jobs[processInfo.gameGUID] = job;
    pushJobToQueue(job);
});
EventBus.on("Cancel Start Game", function (gameGUID: string) {
    let job = jobs[gameGUID];
    if (job) {
        delete jobs[gameGUID];
    }
});

function pushJobToQueue(job: I.Job) {
    Q(amqp.connect(settings.queueURL))
        .then(function (conn) {
            return Q(conn.createChannel()).then(function (ch) {
                let ok = ch.assertQueue(settings.jobQueueName, { durable: true });
                return ok.then(function () {
                    let msg = JSON.stringify(job);
                    logger.info("Pushing job to queue", { codepath: "GameDispatcher.pushJobToQueue", gameGUID: job.processInfo.gameGUID, jobID: job.jobID, jobQueueName: settings.jobQueueName, msg: msg });
                    return Q(ch.sendToQueue(settings.jobQueueName, new Buffer(msg), { persistent: true }))
                        .finally(() => { ch.close() });
                });
            }).finally(() => { conn.close(); });
        })
        .catch((err) => {
            let gameStartInfo: I.GameStartInfo = {
                jobID: job.jobID,
                gameGUID: job.processInfo.gameGUID,
            };
            EventBus.emit("Process Failed To Start", gameStartInfo);
            logger.error("Failed to push job to queue", { codepath: "GameDispatcher.pushJobToQueue", gameGUID: job.processInfo.gameGUID, jobID: job.jobID, jobQueueName: settings.jobQueueName, err: err, errMessage: err.message });
        })
        .done();
}

export function jobCallback(gameGUID: string, jobID: string, connectionInfo: I.ConnectionInfo) {
    //TODO: add logging
    if (jobs[gameGUID] && jobs[gameGUID].processInfo && (jobs[gameGUID].jobID == jobID)) {
        if (connectionInfo && connectionInfo.publicPort && connectionInfo.serverHostName) {
            connectionInfo.publicPort = String(connectionInfo.publicPort);
            let gameStartInfo: I.GameStartInfo = {
                jobID: jobID,
                gameGUID: gameGUID,
                connectionInfo: connectionInfo
            };
            EventBus.emit("Process Started", gameStartInfo);
        } else {
            let gameStartInfo: I.GameStartInfo = {
                jobID: jobID,
                gameGUID: gameGUID,
            };
            delete jobs[gameGUID];
            EventBus.emit("Process Failed To Start", gameStartInfo);
        }
    } else {
        throw new Error("Job not found");
    }
}
