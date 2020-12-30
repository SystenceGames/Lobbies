import redis = require("redis");
import Q = require("q");

import I = require("./Interfaces");
import logger = require("./logger");
import TMError = require('./TMError');
import TMAssert = require('./TMAssert');
import settings = require('./config/settings');
import Lobby = require('./Lobby');

class SteamInviteManager {
    private redisInviteManager: I.RedisInviteManager;
    private matchManager: I.MatchManager;

    constructor(redisInviteManager: I.RedisInviteManager, matchManager: I.MatchManager) {
        this.redisInviteManager = redisInviteManager;
        this.matchManager = matchManager;
    }

    private assertIsInt(thing:any, nameOfField:string) {
        TMAssert(typeof thing === 'string', "Missing " + nameOfField);
        let maybeInt = parseInt(thing, 10);
        TMAssert(!isNaN(maybeInt), "Missing " + nameOfField);
    }

    private assertValidSteamLobbyInviteRequest(reqBody: any) {
        TMAssert(reqBody.receiverSteamId, "Missing Receiver Steam Id");
        this.assertIsInt(reqBody.receiverSteamId, "Receiver Steam Id");
        TMAssert(reqBody.senderSteamId, "Missing Sender Steam Id");
        this.assertIsInt(reqBody.senderSteamId, "Sender Steam Id");
        TMAssert(reqBody.gameGUID, "Missing gameGUID");
        TMAssert(typeof reqBody.gameGUID === 'string', "Missing gameGUID");
        TMAssert(reqBody.port, "Missing Port");
        this.assertIsInt(reqBody.port, "Port");
        TMAssert(reqBody.host, "Missing Host");
        TMAssert(typeof reqBody.host === 'string', "Missing Host");
        TMAssert(reqBody.httpEndpoint, "Missing httpEndpoint");
        TMAssert(typeof reqBody.httpEndpoint === 'string', "Missing httpEndpoint");
        TMAssert(reqBody.senderPlayerName, "Missing senderPlayerName");
        TMAssert(typeof reqBody.senderPlayerName === 'string', "Missing senderPlayerName");
    }

    private steamLobbyInviteFrom(steamInviteRequest: I.AcceptSteamInviteRequest | I.SendSteamInviteRequest): I.SteamInvite {
        return {
            gameGUID: steamInviteRequest.gameGUID,
            host: steamInviteRequest.host,
            httpEndpoint: steamInviteRequest.httpEndpoint,
            port: steamInviteRequest.port,
            receiverSteamId: steamInviteRequest.receiverSteamId,
            senderPlayerName: steamInviteRequest.senderPlayerName,
            senderSteamId: steamInviteRequest.senderSteamId
        };
    }

    public sendSteamLobbyInvite(reqBody: any): Q.Promise<I.SendSteamInviteResponse> {
        let steamInviteRequest: I.SendSteamInviteRequest;
        let steamLobbyInvite: I.SteamInvite;
        return Q.fcall(() => { }).then(() => {
            this.assertValidSteamLobbyInviteRequest(reqBody);
            steamInviteRequest = {
                gameGUID: reqBody.gameGUID,
                host: reqBody.host,
                port: parseInt(reqBody.port, 10),
                receiverSteamId: parseInt(reqBody.receiverSteamId, 10),
                senderSteamId: parseInt(reqBody.senderSteamId, 10),
                httpEndpoint: reqBody.httpEndpoint,
                senderPlayerName: reqBody.senderPlayerName
            };

            steamLobbyInvite = this.steamLobbyInviteFrom(steamInviteRequest);

            let success = this.matchManager.addSteamLobbyInvite(steamLobbyInvite);
            if (!success) {
                return Q.reject(new TMError(false, "Invite not found for gameGUID in SteamInviteManager: " + JSON.stringify(steamLobbyInvite)));
            }
            return this.redisInviteManager.addInvite(steamLobbyInvite); // TODO: update test
        }).then(() => {
            let response: I.SendSteamInviteResponse = { success: true };
            return response;
        });
    }

    public acceptSteamLobbyInvite(reqBody: any): Q.Promise<I.AcceptSteamInviteResponse> {
        return Q.fcall(() => { }).then(() => {
            this.assertValidSteamLobbyInviteRequest(reqBody);
            let steamInviteRequest: I.AcceptSteamInviteRequest = {
                gameGUID: reqBody.gameGUID,
                host: reqBody.host,
                port: parseInt(reqBody.port, 10),
                receiverSteamId: parseInt(reqBody.receiverSteamId, 10),
                senderSteamId: parseInt(reqBody.senderSteamId, 10),
                senderPlayerName: reqBody.senderPlayerName,
                httpEndpoint: reqBody.httpEndpoint
            };

            let steamLobbyInvite: I.SteamInvite = this.steamLobbyInviteFrom(steamInviteRequest);

            return this.redisInviteManager.removeInvite(steamLobbyInvite);
        }).then((numRemoved: number) => {
            return {
                success: numRemoved > 0
            };
        });
    }

    private assertValidRetriveSteamLobbyInvitesRequest(req: any) {
        TMAssert(req.receiverSteamId, "Missing receiverSteamId");
        this.assertIsInt(req.receiverSteamId, "receiverSteamId");
    }

    public retrieveSteamLobbyInvites(reqBody: any): Q.Promise<I.RetrieveSteamInviteResponse>{
        return Q.fcall(() => {}).then(()=> {
            this.assertValidRetriveSteamLobbyInvitesRequest(reqBody);

            let retrieveSteamInviteRequest: I.RetrieveSteamInvitesRequest = {
                playerName: reqBody.playerName,
                receiverSteamId: parseInt(reqBody.receiverSteamId, 10),
                sessionToken: reqBody.sessionToken
            };
            return this.redisInviteManager.steamInvitesFor(retrieveSteamInviteRequest.receiverSteamId);
        }).then((steamInvites: Array<I.SteamInvite>) => {
            return {
                steamLobbyInvites: steamInvites
            };
        });
    }

    // TODO: Add Invites to Lobby to remove when Lobby is deleted
}

export = SteamInviteManager;