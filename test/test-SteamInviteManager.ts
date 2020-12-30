import Q = require('q');
import should = require('should');
require('should');
import sinon = require('sinon');
import LobbyListing = require('../models/LobbyListing');
let db = require('./db-mock');
LobbyListing.db = db;
import I = require('../Interfaces');
import Lobby = require('../Lobby');
import Player = require('../models/Player');
import LobbyPlayer = require('../LobbyPlayer');
import Enums = require('../enums');
import settings = require('../config/settings');
import SteamInviteManager = require('../SteamInviteManager');
import TestFactory = require('./TestFactory');
import MatchManager = require('../MatchManager');

describe('SteamInviteManager', function () {
    let steamInviteManager: SteamInviteManager;
    let mockRedisInviteManager: I.RedisInviteManager;
    let mockMatchManager: I.MatchManager;
    let sandbox: sinon.SinonSandbox;
    let steamLobbyInvite: I.SteamInvite;
    let steamInviteKey: string;
    let returnLrangeResponsePromise: Q.Promise<Array<string>>;
    let returnLremResponsePromise: Q.Promise<number>;
    let games: { [gameGUID: string]: Lobby; } = {};
    let addInviteStub: sinon.SinonStub;
    let removeInviteStub: sinon.SinonStub;
    let removeInvitesStub: sinon.SinonStub;
    let steamInvitesForStub: sinon.SinonStub;
    let steamInvite: I.SteamInvite;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
        
        steamInvite = {
            gameGUID: TestFactory.fakeGameGUID,
            host: TestFactory.fakeHost,
            port: TestFactory.fakePort,
            receiverSteamId: TestFactory.steamId(0),
            senderSteamId: TestFactory.steamId(1),
            senderPlayerName: TestFactory.playerUniqueName(0),
            httpEndpoint: TestFactory.httpEndpoint
        };

        addInviteStub = sinon.stub();
        let promiseOfOne: Q.Promise<number> = Q.fcall(() => {
            return 1;
        });
        removeInviteStub = sinon.stub().withArgs(steamInvite).returns(promiseOfOne);
        let steamInvites: Array<I.SteamInvite> = new Array<I.SteamInvite>(steamInvite);
        let promiseOfSteamInvites: Q.Promise<Array<I.SteamInvite>> =  Q.fcall(() => {
            return steamInvites;
        });
        steamInvitesForStub = sinon.stub().withArgs(TestFactory.steamId(0)).returns(promiseOfSteamInvites);

        mockRedisInviteManager = {
            addInvite: addInviteStub,
            removeInvite: removeInviteStub,
            removeInvites: removeInvitesStub,
            steamInvitesFor: steamInvitesForStub
        }

        mockMatchManager = {
            addSteamLobbyInvite: sinon.stub().returns(true)
        };

        steamLobbyInvite = {
            gameGUID: TestFactory.fakeGameGUID,
            host: TestFactory.fakeHost,
            senderPlayerName: TestFactory.playerUniqueName(0),
            port: TestFactory.fakePort,
            receiverSteamId: TestFactory.steamId(0),
            senderSteamId: TestFactory.steamId(1),
            httpEndpoint: TestFactory.httpEndpoint
        };

        steamInviteKey = "steamInvites:" + TestFactory.steamId(0);

        let steamLobbyInviteArray: Array<string> = new Array<string>();
        steamLobbyInviteArray.push(JSON.stringify(steamLobbyInvite));
        returnLrangeResponsePromise = Q.fcall(() => {
            return steamLobbyInviteArray;
        });

        returnLremResponsePromise = Q.fcall(() => {
            return 1;
        });

        steamInviteManager = new SteamInviteManager(mockRedisInviteManager, mockMatchManager);
    });

    it("1. SendSteamInvite", () => {
        let reqBody: any = {
            gameGUID: TestFactory.fakeGameGUID,
            host: TestFactory.fakeHost,
            port: TestFactory.fakePort + "",
            receiverSteamId: TestFactory.steamId(0) + "",
            senderSteamId: TestFactory.steamId(1) + "",
            senderPlayerName: TestFactory.playerUniqueName(0),
            httpEndpoint: TestFactory.httpEndpoint
        };

        let expected: I.SendSteamInviteResponse = { success: true };

        return steamInviteManager.sendSteamLobbyInvite(reqBody).then((actual: I.SendSteamInviteResponse) => {
            should.deepEqual(actual, expected);
            sinon.assert.calledWith(addInviteStub, steamInvite);
        });
    });

    it("2. SendSteamInvite Missing Receiver Steam Id", function (done) {
        let reqBody: any = {
            senderSteamId: TestFactory.steamId(1) + "",
            gameGUID: TestFactory.fakeGameGUID,
            port: TestFactory.fakePort + "",
            host: TestFactory.fakeHost
        };

        steamInviteManager.sendSteamLobbyInvite(reqBody).then((actual: I.SendSteamInviteResponse) => {
            done(new Error("Did not throw assertion error for missing receiverSteamId"));
        }).catch((err) => {
            sinon.assert.notCalled(addInviteStub);
            done();       
        });
    });

    it("3. SendSteamInvite Missing Sender Steam Id", function (done) {
        let reqBody: any = {
            receiverSteamId: TestFactory.steamId(0) + "",
            gameGUID: TestFactory.fakeGameGUID,
            port: TestFactory.fakePort + "",
            host: TestFactory.fakeHost
        };

        steamInviteManager.sendSteamLobbyInvite(reqBody).then((actual: I.SendSteamInviteResponse) => {
            done(new Error("Did not throw assertion error for missing senderSteamId"));
        }).catch((err) => {
            sinon.assert.notCalled(addInviteStub);
            done();
        });
    });

    it("4. SendSteamInvite Missing GameGUID", function (done) {
        let reqBody: any = {
            receiverSteamId: TestFactory.steamId(0) + "",
            senderSteamId: TestFactory.steamId(1) + "",
            port: TestFactory.fakePort + "",
            host: TestFactory.fakeHost
        };

        steamInviteManager.sendSteamLobbyInvite(reqBody).then((actual: I.SendSteamInviteResponse) => {
            done(new Error("Did not throw assertion error for missing gameGUID"));
        }).catch((err) => {
            sinon.assert.notCalled(addInviteStub);
            done();
        });
    });

    it("5. SendSteamInvite Missing Port", function (done) {
        let reqBody: any = {
            receiverSteamId: TestFactory.steamId(0) + "",
            senderSteamId: TestFactory.steamId(1) + "",
            gameGUID: TestFactory.fakeGameGUID,
            host: TestFactory.fakeHost
        };

        steamInviteManager.sendSteamLobbyInvite(reqBody).then((actual: I.SendSteamInviteResponse) => {
            done(new Error("Did not throw assertion error for missing port"));
        }).catch((err) => {
            sinon.assert.notCalled(addInviteStub);
            done();
        });
    });

    it("6. SendSteamInvite Missing Host", function (done) {
        let reqBody = {
            receiverSteamId: TestFactory.steamId(0) + "",
            senderSteamId: TestFactory.steamId(1) + "",
            gameGUID: TestFactory.fakeGameGUID,
            port: TestFactory.fakePort + ""
        };

        steamInviteManager.sendSteamLobbyInvite(reqBody).then((actual: I.SendSteamInviteResponse) => {
            done(new Error("Did not throw assertion error for missing host"));
        }).catch((err) => {
            sinon.assert.notCalled(addInviteStub);
            done();
        });
    });

    it("1. RetrieveSteamLobbyInvites", () => {
        let reqBody: any = {
            receiverSteamId: TestFactory.steamId(0) + "",
            sessionToken: TestFactory.sessionToken,
            playerName: TestFactory.playerUniqueName(0)
        };

        let expectedSteamLobbyInvites = new Array<I.SteamInvite>();
        expectedSteamLobbyInvites.push(steamLobbyInvite);

        let expected: I.RetrieveSteamInviteResponse = {
            steamLobbyInvites: expectedSteamLobbyInvites
        };

        return steamInviteManager.retrieveSteamLobbyInvites(reqBody).then((actual: I.RetrieveSteamInviteResponse) => {
            should.deepEqual(actual, expected);
        });
    });

    it("2. RetrieveSteamLobbyInvites Missing receiverSteamId", function (done) {
        let reqBody = {
            sessionToken: TestFactory.sessionToken,
            playerName: TestFactory.playerUniqueName(0)
        };

        steamInviteManager.retrieveSteamLobbyInvites(reqBody).then((actual: I.RetrieveSteamInviteResponse) => {
            done(new Error("Did not throw assertion error for missing receiverSteamId"));
        }).catch((err) => {
            sinon.assert.notCalled(steamInvitesForStub);
            done();
        });
    });

    it("1. AcceptSteamLobbyInvite", () => {
        let reqBody: any = {
            gameGUID: TestFactory.fakeGameGUID,
            host: TestFactory.fakeHost,
            port: TestFactory.fakePort + "",
            receiverSteamId: TestFactory.steamId(0) + "",
            senderSteamId: TestFactory.steamId(1) + "",
            senderPlayerName: TestFactory.playerUniqueName(0),
            httpEndpoint: TestFactory.httpEndpoint
        };

        let expected: I.AcceptSteamInviteResponse = {
            success: true
        };

        return steamInviteManager.acceptSteamLobbyInvite(reqBody).then((actual: I.AcceptSteamInviteResponse) => {
            sinon.assert.calledWith(removeInviteStub, steamInvite);
            should.deepEqual(actual, expected);
        });
    });
});
