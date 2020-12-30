import net = require('net');
import enums = require('./enums');
import I = require('./Interfaces');
import EventBus = require('./EventBus');
import Player = require('./models/Player');
import Lobby = require('./Lobby');
import StandardLibraryProxy = require('./StandardLibraryProxy');
import logger = require('./logger');

class MatchManager implements I.MatchManager {
    public games: { [gameGUID: string]: Lobby; } = {};
    private standardLibraryProxy: StandardLibraryProxy;
    private redisInviteManager: I.RedisInviteManager;

    constructor(standardLibraryProxy: StandardLibraryProxy, redisInviteManager: I.RedisInviteManager) {
        this.standardLibraryProxy = standardLibraryProxy;
        this.redisInviteManager = redisInviteManager
    }

    public init() {
        EventBus.on("Process Started", this.processStartedHandler.bind(this));
        EventBus.on("Process Failed To Start", this.processFailedToStartHandler.bind(this));
        EventBus.on("Player Connected", this.playerConnectedHandler.bind(this));
        EventBus.on("Delete Lobby", this.deleteLobbyHandler.bind(this));
    }

    private processStartedHandler(gameStartInfo: I.GameStartInfo) {
        if (this.games[gameStartInfo.gameGUID]) {
            this.games[gameStartInfo.gameGUID].processStarted(gameStartInfo);
        } else {
            logger.warn("MatchManager.processStartedHandler was called for a game that doesn't exist", {
                codepath: "MatchManager.processStartedHandler",
                gameGUID: gameStartInfo.gameGUID, jobID: gameStartInfo.jobID
            });
        }
    }
    private processFailedToStartHandler(gameStartInfo: I.GameStartInfo) {
        if (this.games[gameStartInfo.gameGUID]) {
            this.games[gameStartInfo.gameGUID].processFailedToStart();
        } else {
            logger.warn("MatchManager.processFailedToStartHandler was called for a game that doesn't exist", {
                codepath: "MatchManager.processFailedtoStartHandler",
                gameGUID: gameStartInfo.gameGUID, jobID: gameStartInfo.jobID
            });
        }
    }

    private playerConnectedHandler(message: I.PlayerConnectedMessage) {
        let player = new Player(message.playerName);
        if (this.games[message.gameGUID] && this.games[message.gameGUID].canPlayerConnect(player.uniqueName)) {
            
            player.currentSocket = message.socket;

            player.currentSocket.on('end', () => {
                if (this.games[message.gameGUID]) this.games[message.gameGUID].playerDisconnected(player.uniqueName);
            });
            player.currentSocket.on('error', (e) => {
                logger.warn("Player Socket Error (Now destroying socket)", {
                    codepath: "MatchManager.playerConnectedHandler",
                    error: e, gameGUID: message.gameGUID, playerName: message.playerName, errorMessage:e.message
                });
                if(player.currentSocket) player.currentSocket.destroy();
                if (this.games[message.gameGUID]) this.games[message.gameGUID].playerDisconnected(player.uniqueName);
            });

            this.games[message.gameGUID].playerConnected(player);
        }
        else {
            let errorMessage = JSON.stringify({
                error: new Error("Game not found"),
                result: null
            }) + '\n';
            message.socket.write(errorMessage);
            message.socket.end();
            logger.info("Socket closed since we could not find the relevant game based on gameGUID or the Lobby disallowed the player from connecting", {
                codepath: "MatchManager.playerConnectedHandler",
                gameGUID: message.gameGUID, playerName: message.playerName
            });
        }
    }
    private deleteLobbyHandler(gameGUID:string) { //This private should only be called if all players are removed from game TOO!
        if (this.games[gameGUID]) {
            delete this.games[gameGUID];
        } else {
            logger.error("Tried to delete a game that doesn't exist", { gameGUID: gameGUID});
        }
    }

    public createLobby(gameName: string, mapName: string, gameType: string, playerName: string, callback: (err: Error, response: string) => void) {
        let newGame = Lobby.createLobby(this.standardLibraryProxy, this.redisInviteManager, gameName, mapName, gameType, playerName, callback);
        this.games[newGame.gameGUID] = newGame;
    }

    public listLobbies(callback: (err: Error, response: string) => void) {
        let output = [];
        for (let gameGUID in this.games) {
            let gameListing = this.games[gameGUID].createGameListing();
            if (gameListing) {
                output.push(gameListing)
            }
        }
        let response: string = JSON.stringify(output);
        process.nextTick(() => { callback(null, response) }); //process.nextTick is so that the calling private can presume that the rest of its code runs before the callback returns. This is only because this is not a real async callback
    }

    public callLobby(GUID: string, func: string, lobbyCommandParameters: any, playerUniqueName: string, next: (err: Error, response: string) => void) {
        if (!this.games[GUID]) {
            next(new Error("No such game exists"), null);
            return;
        }
        this.games[GUID].handleClientCalls(func, lobbyCommandParameters, playerUniqueName, next);
    }

    public addSteamLobbyInvite(steamLobbyInvite: I.SteamInvite): boolean {
        if (!this.games[steamLobbyInvite.gameGUID]) {
            logger.error("No such game exists", { steamLobbyInvite: steamLobbyInvite });
            return false;
        }
        this.games[steamLobbyInvite.gameGUID].addSteamLobbyInvite(steamLobbyInvite);
        return true;
    }

	//sends all the lobbies as is. If we want to get every player we can just do a for-each^2 on output.players anyways
	//this isn't an async function
	public toJSON() {
		let output = [];
		for (let gameGUID in this.games) {
			let temp: any = this.games[gameGUID].toJSON();
			output.push(temp);
			//this is sending an array of arrays of strings; 
			//array of lobbies; each lobby has array of players (which have playerNames)
			//get names via for (let lobby in output) for (let player in lobby) console.log(player.playerName);
		}
		return output;
	}

}


export = MatchManager;