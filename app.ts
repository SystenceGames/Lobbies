import http = require('http');
import https = require('https');
import fs = require('fs');
import querystring = require('querystring');
let jwt = require('jsonwebtoken');
import Q = require('q');
Q.longStackSupport = true;

/** Express related requires **/
import express = require('express');
let morgan = require('morgan');
let bodyParser = require('body-parser');

/** Import own JS files **/
import I = require('./Interfaces');
import logger = require('./logger');
import settings = require('./config/settings');
import Player = require('./models/Player');
import MatchManager = require('./MatchManager');
import GameDispatcher = require('./GameDispatcher');
import LobbyListing = require('./models/LobbyListing');
import StandardLibraryProxy = require('./StandardLibraryProxy');
import PlayerCommunicator = require('./PlayerCommunicator');
import SteamInviteManager = require('./SteamInviteManager');
import RedisClientWrapper = require('./RedisClientWrapper');
import RedisInviteManager = require('./RedisInviteManager');
import PlatformStatusService = require('./PlatformStatusService');
import PlatformStatusDb = require('./PlatformStatusDb');
import MongoDbConnectionManager = require('./MongoDbConnectionManager');

let db = require('./db');
LobbyListing.db = db;

let standardLibraryProxy: StandardLibraryProxy = new StandardLibraryProxy();
let redisClientWrapper: I.RedisClientWrapper = new RedisClientWrapper(db);
let redisInviteManager: I.RedisInviteManager = new RedisInviteManager(redisClientWrapper);
let matchManager: MatchManager = new MatchManager(standardLibraryProxy, redisInviteManager);
let playerCommunicator: PlayerCommunicator = new PlayerCommunicator(matchManager);
let steamInviteManager: SteamInviteManager = new SteamInviteManager(redisInviteManager, matchManager);
let mongoDbConnectionManager = new MongoDbConnectionManager();
let platformStatusDb = new PlatformStatusDb(mongoDbConnectionManager, standardLibraryProxy);
let platformStatusService: PlatformStatusService = new PlatformStatusService(platformStatusDb);
mongoDbConnectionManager.connect().then(() => {
	platformStatusDb.init();
	platformStatusService.init();
});
matchManager.init();
playerCommunicator.init();

LobbyListing.startRefreshingListings();

/** App Setup **/
let app = express();
let jsonFormatter = function (tokens: any, req: any, res: any) {
    let obj: any = {
        url: tokens.url(req, res),
        statusCode: tokens.status(req, res),
        durationMs: parseInt(tokens['response-time'](req, res), 10)
    };
    return JSON.stringify(obj);
}
app.use(morgan(jsonFormatter, { stream: logger.stream }));
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.static(__dirname + '/public'));

app.get('/isRunning', function (req: any, res: any) {
    res.json(200, true);
});

//Fix so that bodyParser will work even though the client doesn't set content-type
app.all('*', function (req: any, res: any, next: any) {
    if (!req.headers['content-type']) {
        req.headers['content-type'] = 'application/x-www-form-urlencoded';
    }
    next();
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/jobCallback/:gameGUID/:jobID', function (req: any, res: any, next: any) {
    if (!req.params.jobID) return next(new Error("Request must include jobID in URL"));
    if (!req.params.gameGUID) return next(new Error("Request must include gameGUID in URL"));

    try {
        GameDispatcher.jobCallback(req.params.gameGUID, req.params.jobID, { serverHostName: req.body.serverHostName, publicPort: req.body.publicPort });
        res.json(200, { "status": "Succcess!" });
        res.end();
	} catch (err) {
		logger.error("Lobbies error in jobCallback", { jobID: req.params.jobID, gameGUID: req.params.gameGUID, error: err });
		res.json(500, { status: "kill job", error: err.message });
        res.end();
    }
});

/** Authenticate and get player **/
app.all('*', function (req: any, res: any, next: any) {
    if (req.url == "/isRunning" || req.url == "/v1/platformMOTD" || req.url == "/favicon.ico") return next(); // keeps it from throwing errors for a message that doesn't need this stuff.
    if (!req.body.sessionToken) return next(new Error("Request must include sessionToken"));
    if (typeof req.body.sessionToken !== 'string') return next(new Error("Request must include sessionToken"));
    if (!req.body.playerName) return next(new Error("Request must include playerName"));
    if (typeof req.body.playerName !== 'string') return next(new Error("Request must include playerName"));
    //To disable account verification: req.player = Player.getOrCreatePlayer(req.body.playerName); return next();
    jwt.verify(req.body.sessionToken, settings.JWTSecret, null, (err: any, decoded: any) => {
        if (err) return next(new Error('invalid session'));
        if (!decoded.u) return next(new Error('invalid session: does not include uniqueName'));
        if (decoded.u != req.body.playerName.toUpperCase()) return next(new Error('invalid session: uniqueName does not match req.playerName'));

        req.playerUniqueName = Player.getUniqueNameFromPlayerName(req.body.playerName);
        next();
    });
});

function successResponseHandler(responsePayload: any, res: express.Response) {
    res.json(responsePayload);
    res.status(200);
}

const GENERIC_ERROR_MESSAGE: string = "There was an error handling your request";

function failResponseHandler(err: any, res: express.Response) {
    if (!err) {
        logger.error("A rejection was caught at the top level without an error");
        return;
    }

    if (err.isPlayerFacing) {
        let errorMessage;
        if (err && err.message) {
            errorMessage = err.message;
        }
        logger.error(err);
        res.json(200, { error: errorMessage });
    } else {
        logger.error(err);
        res.json(200, { error: GENERIC_ERROR_MESSAGE });
    }
}

app.all('/v1/platformMOTD', function (req: any, res: any) {
    Q.fcall(() => {
        return platformStatusService.platformMOTD();
    }).then((responsePayload) => {
        successResponseHandler(responsePayload, res);
    }).catch((err) => {
        failResponseHandler(err, res);
    });
});

app.post('/v1/sendSteamLobbyInvite', function (req: any, res: any) {
    Q.fcall(() => {
        return steamInviteManager.sendSteamLobbyInvite(req.body);
    }).then((responsePayload) => {
        successResponseHandler(responsePayload, res);
    }).catch((err) => {
        failResponseHandler(err, res);
    });
});

app.post('/v1/declineSteamLobbyInvite', function (req: any, res: any) {
    Q.fcall(() => {
        return steamInviteManager.acceptSteamLobbyInvite(req.body); // shhh, they actually just delete the invite.
    }).then((responsePayload) => {
        successResponseHandler(responsePayload, res);
    }).catch((err) => {
        failResponseHandler(err, res);
    });
});

app.post('/v1/acceptSteamLobbyInvite', function (req: any, res: any) {
    Q.fcall(() => {
        return steamInviteManager.acceptSteamLobbyInvite(req.body);
    }).then((responsePayload) => {
        successResponseHandler(responsePayload, res);
    }).catch((err) => {
        failResponseHandler(err, res);
    });
});

app.post('/v1/retrieveSteamLobbyInvites', function (req: any, res: any) {
    Q.fcall(() => {
        return steamInviteManager.retrieveSteamLobbyInvites(req.body);
    }).then((responsePayload) => {
        successResponseHandler(responsePayload, res);
    }).catch((err) => {
        failResponseHandler(err, res);
    });
});

app.post('/v1/hostGame', function (req: any, res: any, next: any) {
    if (!req.body.gameName) return next(new Error("Request must include gameGUID"));
    if (!req.body.mapName) return next(new Error("Request must include mapName"));
    if (!req.body.gameType) return next(new Error("Request must include gameType"));
    
    Q.fcall(() => {
        return matchManager.createLobby(req.body.gameName, req.body.mapName, req.body.gameType, req.body.playerName, (err, response) => {
            if (err) return next(err);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.write(response);
            res.end();
        });
    });
});
app.post('/v1/listGames', function (req: any, res: any, next: any) {
    LobbyListing.getAllListings()
        .then((resp) => {
            res.json(200, resp);
        })
        .catch(next)
        .done();
});
app.post('/v1/joinGame', function (req: any, res: any, next: any) {
    callUpdateLobbyInfoWithCommand(req, res, next, 'joinLobby');
});
app.post('/v1/startGame', function (req: any, res: any, next: any) {
    callUpdateLobbyInfoWithCommand(req, res, next, 'startMatch');
});
app.post('/v1/updateLobbyInfo', function (req: any, res: any, next: any) {
    callUpdateLobbyInfoWithCommand(req, res, next, 'updateLobbyInfo');
});
app.post('/v1/updateLobbyInfo/:command', function (req: any, res: any, next: any) {
    callUpdateLobbyInfoWithCommand(req, res, next, req.params.command);
});

function callUpdateLobbyInfoWithCommand(req: any, res: any, next: any, command: any) {
    if (!req.body.gameGUID) return next(new Error("Request must include gameGUID"));
    Q.fcall(() => {
        matchManager.callLobby(req.body.gameGUID, command, req.body.lobbyCommandParameters, req.playerUniqueName, (err, response) => {
            if (err) return next(err);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.write(response);
            res.end();
        });
    });
}

/** Error Handler **/
app.use(function (err: any, req: any, res: any, next: any) {
    logger.warn("Returning an error", { codepath: "Lobbies.errorHandler", error: err, errMessage: err.message, url: req.url });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.write(JSON.stringify({ "error": err.message }));
    res.end();
})

if (fs.existsSync(settings.sslConfigPath)) {
    let tempApp: any = app;
    https.createServer({
        pfx: fs.readFileSync(require(settings.sslConfigPath).pfx),
        passphrase: require(settings.sslConfigPath).passphrase
    }, tempApp.handle.bind(app)).listen(settings.httpDirectPort, '0.0.0.0');
    https.createServer({
        pfx: fs.readFileSync(require(settings.sslConfigPath).pfx),
        passphrase: require(settings.sslConfigPath).passphrase
    }, tempApp.handle.bind(app)).listen(settings.httpLoadBalancedPort, '0.0.0.0');
    logger.info('SECURE server running on localhost', { codepath: "index.https.createServer", httpDirectPort: settings.httpDirectPort, httpLoadBalancedPort: settings.httpLoadBalancedPort });
} else {
    let tempApp: any = app;
    http.createServer(tempApp.handle.bind(app)).listen(settings.httpDirectPort, '0.0.0.0');
    http.createServer(tempApp.handle.bind(app)).listen(settings.httpLoadBalancedPort, '0.0.0.0');
    logger.info('Server running on localhost', { codepath: "index.http.createServer", httpDirectPort: settings.httpDirectPort, httpLoadBalancedPort: settings.httpLoadBalancedPort });
}

process.on('uncaughtException', function (err: any) {
    debugger;
    logger.error("Uncaught Node Exception", { codepath: "index.on.uncaughtException", error: err, errorStack: err.stack });
});

logger.info("Lobbies has started");
let printableSettings: any = settings;
logger.info(JSON.stringify(printableSettings.__proto__, null, 2));