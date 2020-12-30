import Q = require('q');
import redis = require('redis');
import I = require('../Interfaces');
import settings = require('../config/settings');
import logger = require('../logger');

class LobbyListing {
    public static db: redis.RedisClient;
    public static ErrorState: boolean = true;
    public static latestListings: I.LobbyListing[] = [];
    public static startRefreshingListings() {
        let inScheduler = false;
        setInterval(() => {
            if (!inScheduler) {
                inScheduler = true;
                LobbyListing._updateAllListings()
                    .catch(_errorHandler)
                    .finally(() => { inScheduler = false; })
                    .done();
            }
        }, settings.lobbyListingsUpdateFrequency);

        function _errorHandler(err: Error): Q.Promise<{}> {
            LobbyListing.ErrorState = true;
            logger.warn('Caught error in LobbyListing scheduler', { codepath: "GameServer.startRefreshingListings", error: err, errorMessage: err.message});
            return;
        }
    }
    public static getAllListings(): Q.Promise<I.LobbyListing[]> {
        if (LobbyListing.ErrorState)
            return Q.reject<I.LobbyListing[]>(new Error("Could not retrieve game listings from server"));
        else
            return Q.resolve(LobbyListing.latestListings);
    }

    public static _getByName(guid: string): Q.Promise<I.LobbyListing> {
        return Q.ninvoke<string>(LobbyListing.db, 'get', 'lobbies:' + guid)
            .then((lobbyListingString) => {
                if (lobbyListingString) {
                    return Q.resolve(JSON.parse(lobbyListingString));
                }
                else {
                    return Q.reject(); //might have to throw error here
                }
            })
            .then(null, (err) => {
                return LobbyListing._removeFromList(guid).thenResolve(null);
            });
    }
    public static _list(): Q.Promise<string[]> {
        return Q.ninvoke<string[]>(LobbyListing.db, 'smembers', 'lobbies-set');
    }
    public static _updateAllListings(): Q.Promise<void> {
        return LobbyListing
            ._list()
            .then((gameGUIDs) => {
                return Q.all(gameGUIDs.map(LobbyListing._getByName));
            })
            .then((lobbyListings) => {
                return lobbyListings.filter((lobbyListing) => {
                    if (lobbyListing) return true;
                    else return false;
                });
            })
            .then((listings: I.LobbyListing[]) => {
                LobbyListing.latestListings = listings;
                LobbyListing.ErrorState = false;
            });
    }

    public static addOrUpdate(lobbyListing: I.LobbyListing): Q.Promise<{}> {
        return Q.fcall(() => {
            let multi = LobbyListing.db.multi([
                ['setex', 'lobbies:' + lobbyListing.gameGUID, settings.redisLobbyInactiveTimeout, JSON.stringify(lobbyListing)],
                ['sadd', 'lobbies-set', lobbyListing.gameGUID]
            ]);
            return Q.ninvoke(multi, 'exec');
        });
    }
    public static _removeFromList(guid: string): Q.Promise<{}> {
        return Q.ninvoke(LobbyListing.db, 'srem', 'lobbies-set', guid);
    }

    public static remove(guid: string): Q.Promise<{}> {
        return Q.fcall(() => {
            let multi = LobbyListing.db.multi([
                ['del', 'lobbies:' + guid],
                ['srem', 'lobbies-set', guid]
            ]);
            return Q.ninvoke(multi, 'exec');
        });
    }
}

export = LobbyListing;