import redis = require("redis");
import Q = require("q");

import I = require("./Interfaces");
import logger = require("./logger");
import TMError = require('./TMError');
import TMAssert = require('./TMAssert');
import settings = require('./config/settings');
import Lobby = require('./Lobby');


class RedisInviteManager implements I.RedisInviteManager {
    public redisClientWrapper: I.RedisClientWrapper;

    constructor(redisClientWrapper: I.RedisClientWrapper) {
        this.redisClientWrapper = redisClientWrapper;
    }

    public addInvite(steamLobbyInvite: I.SteamInvite): Q.Promise<any> {
        return this.redisClientWrapper.multi([
            ['rpush', this.steamLobbyInviteKeyFrom(steamLobbyInvite.receiverSteamId), JSON.stringify(steamLobbyInvite)],
            ['expire', this.steamLobbyInviteKeyFrom(steamLobbyInvite.receiverSteamId), settings.redisSteamInviteExpireInSeconds]
        ]);
    }

    private steamLobbyInviteKeyFrom(receiverSteamId: number): string {
        return 'steamInvites:' + receiverSteamId;
    }

    public steamInvitesFor(receiverSteamId: number): Q.Promise<Array<I.SteamInvite>> {
        let steamInvites: Array<I.SteamInvite> = new Array<I.SteamInvite>();
        return this.redisClientWrapper.lrange(this.steamLobbyInviteKeyFrom(receiverSteamId), 0, -1).then((list: Array<string>) => {
            for (let i = 0; i < list.length; ++i) {
                let raw = JSON.parse(list[i]);
                let steamLobbyInvite: I.SteamInvite = {
                    gameGUID: raw.gameGUID,
                    host: raw.host,
                    senderPlayerName: raw.senderPlayerName,
                    port: raw.port,
                    receiverSteamId: raw.receiverSteamId,
                    senderSteamId: raw.senderSteamId,
                    httpEndpoint: raw.httpEndpoint
                };
                steamInvites.push(steamLobbyInvite);
            }
            return steamInvites;
        });
    }

    public removeInvites(steamLobbyInvites: Array<I.SteamInvite>): Q.Promise<any> {
        let multiArgs: Array<any> = steamLobbyInvites.map((steamLobbyInvite: I.SteamInvite) => {
            return ['lrem', this.steamLobbyInviteKeyFrom(steamLobbyInvite.receiverSteamId), 0, JSON.stringify(steamLobbyInvite)];
        });
        return this.redisClientWrapper.multi(multiArgs);
    }

    public removeInvite(steamLobbyInvite: I.SteamInvite): Q.Promise<number> {
        return this.redisClientWrapper.lrem(this.steamLobbyInviteKeyFrom(steamLobbyInvite.receiverSteamId), 0, JSON.stringify(steamLobbyInvite));
    }
}

export = RedisInviteManager;