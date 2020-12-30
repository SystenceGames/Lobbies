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
import EventBus = require('../EventBus');
import settings = require('../config/settings');
import enums = require('../enums');


describe('Lobby Listings', function () {
    let listing1: I.LobbyListing = <I.LobbyListing>{ gameGUID: "game-ID1" };
    let listing2: I.LobbyListing = <I.LobbyListing>{ gameGUID: "game-ID2" };
    let unParsableString = "{asfdg";
    let sandbox: any;
    let callingPlayer: Player;
    let lobby: Lobby;
    let bot0TeamNumber: number;
    let bot0PlayerName: string;
    let bot0PlayerUniqueName: string;
    let bot0Difficulty: Enums.BotDifficulty;
    let bot1TeamNumber: number;
    let bot1PlayerName: string;
    let bot1PlayerUniqueName: string;
    let bot1Difficulty: Enums.BotDifficulty;
    let teamMaxSize: number = 3;
    let addBot0LobbyCommandParamsString: string;
    let addBot1LobbyCommandParamsString: string;
    let addBot0LobbyCommandParams: any;
    let bot0Player: Player;
    let bot0LobbyPlayer: LobbyPlayer;
    let bot1Player: Player;
    let bot1LobbyPlayer: LobbyPlayer;
    let addBot1LobbyCommandParams: any;
    let playerNameToKick: string;
    let playerToKick: Player;
    let lobbyPlayerToKick: LobbyPlayer;
    let callingPlayerName: string;
    let callingPlayerUniqueName: string;
    let fakeGameGUID: string;
    let fakeMapName: string;
    let fakeGameType: string;
    let spectatorTeamNumber: number;
    let spectatorPlayerName: string;
    let spectatorUniqueName: string;
    let spectatorPlayer: Player;
    let spectatorLobbyPlayer: LobbyPlayer;
    let mockStandardLibraryProxy: any;
    let mockRedisInviteManager: I.RedisInviteManager;
    let redisInviteManagerRemoveInvitesStub: sinon.SinonStub;

    beforeEach(function (done) {
        let stupidTypescript: any = LobbyListing.db;
        stupidTypescript.flushdb(function () {
            done();
        });
        sandbox = sinon.sandbox.create();
        mockStandardLibraryProxy = {
            randomInt: sandbox.stub(),
            setTimeout: sandbox.stub(),
            getTime: sandbox.stub()
        };

        let promiseOfEmptyObject: Q.Promise<any> = Q.fcall(() => {
            return {};
        }); 
        redisInviteManagerRemoveInvitesStub = sinon.stub().returns(promiseOfEmptyObject);
        mockRedisInviteManager = {
            addInvite: sandbox.stub(),
            removeInvite: sandbox.stub(),
            removeInvites: redisInviteManagerRemoveInvitesStub,
            steamInvitesFor: sandbox.stub()
        }

        callingPlayerName = "fakeHostName";
        callingPlayerUniqueName = Player.getUniqueNameFromPlayerName(callingPlayerName);
        callingPlayer = new Player(callingPlayerName);
        fakeGameGUID = "fakeGameGUID";
        fakeMapName = "fakeMapName";
        fakeGameType = "fakeGameType";
        lobby = new Lobby(mockStandardLibraryProxy, mockRedisInviteManager, fakeGameGUID, "fakeGameName", fakeMapName, fakeGameType, teamMaxSize, callingPlayer);
        bot0TeamNumber = 1;
        bot0PlayerName = "bot0PlayerName";
        bot0Difficulty = Enums.BotDifficulty.Intermediate;
        bot0PlayerUniqueName = Player.getUniqueNameFromPlayerName(bot0PlayerName);
        addBot0LobbyCommandParams = {
            playerName: bot0PlayerName,
            botDifficulty: bot0Difficulty,
            teamNumber: bot0TeamNumber
        };
        addBot0LobbyCommandParamsString = JSON.stringify(addBot0LobbyCommandParams);
        bot1TeamNumber = 2;
        bot1PlayerName = "bot1PlayerName";
        bot1Difficulty = Enums.BotDifficulty.Beginner;
        bot1PlayerUniqueName = Player.getUniqueNameFromPlayerName(bot1PlayerName);
        addBot1LobbyCommandParams = {
            playerName: bot1PlayerName,
            botDifficulty: bot1Difficulty,
            teamNumber: bot1TeamNumber
        };
        addBot1LobbyCommandParamsString = JSON.stringify(addBot1LobbyCommandParams);
        playerNameToKick = "playerNameToKick";
        playerToKick = new Player(playerNameToKick);
        lobbyPlayerToKick = new LobbyPlayer(playerToKick, 1);
        spectatorTeamNumber = 3;
        spectatorPlayerName = "spectatorPlayerName";
        spectatorUniqueName = Player.getUniqueNameFromPlayerName(spectatorPlayerName);
        spectatorPlayer = new Player(spectatorPlayerName);
        spectatorLobbyPlayer = new LobbyPlayer(spectatorPlayer, spectatorTeamNumber);
        bot0Player = new Player(bot0PlayerName);
        bot0LobbyPlayer = new LobbyPlayer(bot0Player, bot0TeamNumber);
        bot0LobbyPlayer.isBot = true;
        bot0LobbyPlayer.botDifficulty = bot0Difficulty;

        bot1Player = new Player(bot1PlayerName);
        bot1LobbyPlayer = new LobbyPlayer(bot1Player, bot1TeamNumber);
        bot1LobbyPlayer.isBot = true;
        bot1LobbyPlayer.botDifficulty = bot1Difficulty;
    });
    it("createGameListing success", () => {
        let result = lobby.createGameListing();
        let expected = {
            gameName: lobby.gameName,
            mapName: lobby.mapName,
            gameType: lobby.gameType,
            numOfPlayers: 1,
            hostName: "fakeHostName",
            gameGUID: lobby.gameGUID
        };
        result.should.deepEqual(expected);
    });
    it("createGameListing fail", () => {
        lobby.status = enums.LobbyInfoState.GameCanceled;
        let result = lobby.createGameListing();
        let expected = null;
        should.deepEqual(expected, result);
    });
    it("getByName with JSON parsable", () => {
        return LobbyListing.addOrUpdate(listing1)
            .then((listing) => {
                return LobbyListing._getByName(listing1.gameGUID)
            })
            .then((listing) => {
                should(listing).be.an.Object;
                listing.gameGUID.should.equal(listing1.gameGUID);
            });
    });
    it("getByName with none", () => {
        let spyRemoveFromList = sandbox.stub(LobbyListing, '_removeFromList').returns(Q.resolve({}));
        return LobbyListing._getByName(listing1.gameGUID)
            .then((listing) => {
                sinon.assert.calledOnce(spyRemoveFromList);
                should(listing).eql(null);
            });
    });
    it("getByName with JSON parsable", () => {
        let spyRemoveFromList = sandbox.stub(LobbyListing, '_removeFromList').returns(Q.resolve({}));
        return Q.ninvoke<string>(LobbyListing.db, 'set', 'lobbies:' + listing1.gameGUID, unParsableString)
            .then((listing) => {
                return LobbyListing._getByName(listing1.gameGUID)
            })
            .then((listing) => {
                sinon.assert.calledOnce(spyRemoveFromList);
                should(listing).eql(null);
            });
    });

    it("getAllListings with two JSON parsable, one non existent, one bad", () => {
        return Q.all([
            LobbyListing.addOrUpdate(listing1),
            LobbyListing.addOrUpdate(listing2),
            Q.ninvoke<string>(LobbyListing.db, 'set', 'lobbies:bad', unParsableString),
            Q.ninvoke<string>(LobbyListing.db, 'sadd', 'lobbies-set', 'lobbies:bad'),
            Q.ninvoke<string>(LobbyListing.db, 'sadd', 'lobbies-set', 'lobbies:noexist')
        ])
            .then(() => {
                return Q.all([LobbyListing._updateAllListings()]);
            })
            .then(() => {
                return LobbyListing.getAllListings();
            })
            .then((listings) => {
                should(listings).be.an.Array;
                listings.length.should.equal(2);
                listings[0].gameGUID.should.equal(listing1.gameGUID);
                listings[1].gameGUID.should.equal(listing2.gameGUID);
            });
    });

    it("createProcessInfo works", () => {
        lobby.players[spectatorUniqueName] = spectatorLobbyPlayer;
        lobby.players[bot0PlayerUniqueName] = bot0LobbyPlayer;
        lobby.players[bot1PlayerUniqueName] = bot1LobbyPlayer;
        let bot0CommanderName: string = "bot0Commander";
        let bot1CommanderName: string = "bot1Commander";
        lobby.players[bot0PlayerUniqueName].commanderSelected = bot0CommanderName;
        lobby.players[bot1PlayerUniqueName].commanderSelected = bot1CommanderName;
        let expectedResult: I.ProcessInfo = {
            activePlayerCount: 1,
            gameGUID: fakeGameGUID,
            settings: {
                aiPlayers: [
                    {
                        allyId: bot0TeamNumber - 1, 
                        botDifficulty: bot0Difficulty,
                        commanderName: bot0CommanderName,
                        playerName: bot0PlayerName,
                    },
                    {
                        allyId: bot1TeamNumber - 1,
                        botDifficulty: bot1Difficulty,
                        commanderName: bot1CommanderName,
                        playerName: bot1PlayerName,
                    }
                ],
                gameType: fakeGameType,
                mapName: fakeMapName
            }
        };

        let result: I.ProcessInfo = lobby.createProcessInfo();

        should(result).eql(expectedResult);
    });

    it("addBot doesn't add a bot if there's a player with the same name", () => {
        let existingPlayer: LobbyPlayer = new LobbyPlayer(new Player("existing"), 1);
        lobby.players[bot0PlayerUniqueName] = existingPlayer;

        lobby.addBot(callingPlayer, addBot0LobbyCommandParamsString);

        should(lobby.players[bot0PlayerUniqueName]).equal(existingPlayer);
    });

    it("addBot doesn't add a bot if a non-host player called it", () => {
        lobby.players[callingPlayer.uniqueName].host = false;
        let threw: boolean = false;
        try {
            lobby.addBot(callingPlayer, addBot0LobbyCommandParamsString);
        }
        catch (e) {
            threw = true;
        }
        threw.should.equal(true);
        should(lobby.players[bot0PlayerUniqueName]).be.empty;
    });

    it("addBot doesn't add a bot if there's no room on the team", () => {
        let existingPlayer1Name: string = "existing1";
        let existingPlayer2Name: string = "existing2";
        let existingPlayer1: LobbyPlayer = new LobbyPlayer(new Player(existingPlayer1Name), bot0TeamNumber);
        let existingPlayer2: LobbyPlayer = new LobbyPlayer(new Player(existingPlayer2Name), bot0TeamNumber);
        lobby.players[existingPlayer1Name] = existingPlayer1;
        lobby.players[existingPlayer2Name] = existingPlayer2;

        lobby.addBot(callingPlayer, addBot0LobbyCommandParamsString);

        should(lobby.players[bot0PlayerUniqueName]).be.empty;
    });

    it("addBot", () => {
        let stubUpdateAllPlayers = sandbox.stub(lobby, 'updateAllPlayers');

        lobby.addBot(callingPlayer, addBot0LobbyCommandParamsString);

        should(lobby.players[bot0PlayerUniqueName]).have.properties(bot0LobbyPlayer);
        sinon.assert.calledOnce(stubUpdateAllPlayers);
    });

    it("kickPlayer", () => {
        let stubUpdateAllPlayers = sandbox.stub(lobby, 'updateAllPlayers');
        lobby.players[playerToKick.uniqueName] = lobbyPlayerToKick;

        lobby.kickPlayer(callingPlayer, playerNameToKick);

        should(lobby.players[playerToKick.uniqueName]).be.empty;
        sinon.assert.calledOnce(stubUpdateAllPlayers);
    });

    it("kickPlayer doesn't kick if you aren't the host", () => {
        lobby.players[playerToKick.uniqueName] = lobbyPlayerToKick;

        let threw: boolean = false;
        try {
            lobby.kickPlayer(playerToKick, callingPlayerName);
        }
        catch (e) {
            threw = true;
        }
        threw.should.equal(true);
        should(lobby.players[playerToKick.uniqueName]).equal(lobbyPlayerToKick);
    });

    it("lockTeams", () => {
        lobby.players[bot0PlayerUniqueName] = bot0LobbyPlayer;
        let notSoRandom: number = 2;
        let currentTime: number = 1234;
        mockStandardLibraryProxy.randomInt.withArgs(settings.commandersForBotsToSelect.length).returns(notSoRandom);
        mockStandardLibraryProxy.getTime.returns(currentTime);

        lobby.lockTeams(callingPlayer);

        should(lobby.status).equal(Enums.LobbyInfoState.CommanderSelect);
        should(bot0LobbyPlayer.commanderSelectState).equal(Enums.CommanderSelectStatus.Locked);
        should(bot0LobbyPlayer.commanderSelected).equal(settings.commandersForBotsToSelect[notSoRandom]);
        should(lobby.commanderSelectStartTime).equal(currentTime);
    });

    it("lockTeams timeout", () => {
        lobby.players[bot0PlayerUniqueName] = bot0LobbyPlayer;
        let notSoRandom: number = 2;
        mockStandardLibraryProxy.randomInt.withArgs(settings.commandersForBotsToSelect.length).returns(notSoRandom);
        let timeoutDuration: number = settings.lobbyTimeoutInMs + settings.lobbyTimeoutBufferInMs;
        mockStandardLibraryProxy.setTimeout.withArgs(sinon.match.func, timeoutDuration).callsArg(0);
        let currentTime: number = 1234;
        mockStandardLibraryProxy.getTime.returns(currentTime);

        lobby.lockTeams(callingPlayer);

        should(lobby.status).equal(Enums.LobbyInfoState.TeamSelect);
        should(bot0LobbyPlayer.commanderSelectState).equal(Enums.CommanderSelectStatus.Unselected);
        should(lobby.commanderSelectStartTime).equal(currentTime);
    });

    it("lockTeams won't work with no human players on team 1 or 2", () => {
        lobby.players[bot0PlayerUniqueName] = bot0LobbyPlayer;
        lobby.players[callingPlayerUniqueName].teamNumber = spectatorTeamNumber;
        let threw: boolean = false;

        try {
            lobby.lockTeams(callingPlayer);
        }
        catch (e) {
            threw = true;
        }

        threw.should.equal(true);
    });

    it("playerDisconnected", () => {
        let eventBusEmitStub: sinon.SinonStub = sandbox.stub(EventBus, 'emit');
        let lobbyListingRemoveStub: sinon.SinonStub = sandbox.stub(LobbyListing, 'remove');
        let somePromise: Q.Promise<any> = Q.fcall(() => {
            return 0;
        });
        lobbyListingRemoveStub.withArgs(fakeGameGUID).returns(somePromise);


        lobby.playerDisconnected(callingPlayer.uniqueName);

        sinon.assert.calledWith(eventBusEmitStub, "Cancel Start Game", fakeGameGUID);
        sinon.assert.calledWith(eventBusEmitStub, "Delete Lobby", fakeGameGUID);
        sinon.assert.calledWith(eventBusEmitStub, "Cancel Start Game", fakeGameGUID);
        should.equal(lobby.status, enums.LobbyInfoState.TeamSelect); //This looks dumb to be TeamSelect at the end rather then GameCanceled

        sinon.assert.calledWith(redisInviteManagerRemoveInvitesStub, lobby.invites);
    });

    afterEach(() => {
        sandbox.restore();
    });

});

//Test getByName with JSON parsable: returns {}:any, list is same
//Test getByName with none found: returns null, list is empty
//Test getByName with non JOSN parsable: return null, list is empty

//test getAllListings with two JSON parsable: returns {}:any[]
//test getAllListings with two JSON parsable, one non existent: returns {}:any[].length==2
//test getAllListings withone non existent: returns empty array
