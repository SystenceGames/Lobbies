let uuid = require('node-uuid');
import Q = require('q');
import I = require('./Interfaces');
import enums = require('./enums');
import settings = require('./config/settings');
import EventBus = require('./EventBus');
import Player = require('./models/Player');
import LobbyPlayer = require('./LobbyPlayer');
import LobbyListing = require('./models/LobbyListing');
import logger = require('./logger');
import StandardLibraryProxy = require('./StandardLibraryProxy');

class Lobby {
    public static DEFAULT_MAP_NAME: string = settings.defaultMapName;
    public static INVALID_TIME_REMAINING: number = -1;

    public gameGUID: string;

    public players: { [uniqueName: string]: LobbyPlayer } = {};
    public status: enums.LobbyInfoState;
    public connectionInfo: I.ConnectionInfo;
    public commanderSelectStartTime: number;

    private lobbyStartMatchTime = 0;
    private standardLibraryProxy: StandardLibraryProxy;
    private redisInviteManager: I.RedisInviteManager;
    private timeoutTimer: NodeJS.Timer;

    //Game settings
    public gameName: string;
    public mapName: string;
    public gameType: string;
    public teamMaxSize: number;

    public invites: Array<I.SteamInvite> = new Array<I.SteamInvite>();

    static buildHttpEndpoint(): string {
        return "http://" + settings.callbackBaseURL + ":" + settings.httpDirectPort + "/";
    }

    static createLobby(standardLibraryProxy: StandardLibraryProxy, redisInviteManager: I.RedisInviteManager, gameName: string, mapName: string, gameType: string, playerName: string, next: (err: Error, response: string) => void): Lobby {
        let player = new Player(playerName);

        if (settings.forceDefaultMapOnLobbyStart != null) {
            mapName = settings.forceDefaultMapOnLobbyStart;
        }

        let newLobby = new Lobby(standardLibraryProxy, redisInviteManager, null, gameName, mapName, gameType, null, player);

        let response = JSON.stringify({
            gameName: newLobby.gameName,
            gameGUID: newLobby.gameGUID,
            connectionKey: player.connectionKey,
            httpEndpoint: Lobby.buildHttpEndpoint(),
            host: settings.callbackBaseURL,
            port: settings.socketServerPort.toString()
        });
        process.nextTick(() => { next(null, response) });
        return newLobby;
    }

    constructor(standardLibraryProxy: StandardLibraryProxy, redisInviteManager: I.RedisInviteManager, gameGUID?: string, gameName?: string, mapName?: string, gameType?: string, teamMaxSize?: number, host?: Player) {
        this.gameGUID = gameGUID || uuid.v4();
        this.gameName = gameName || "DefaultGameName";
        this.mapName = mapName || Lobby.DEFAULT_MAP_NAME;
        this.gameType = gameType || "TheMaestrosGame.TMRoundBasedGameInfo";
        this.teamMaxSize = teamMaxSize || 3;
        this.status = enums.LobbyInfoState.TeamSelect; //Do not use function 'pushLobbyListing' since we need to set state before host joining and update redis after host has joined
        if (host) {
            this.addPlayerToLobby(host);
            this.players[host.uniqueName].host = true;
            this.setConnectionTimeout(host.uniqueName);
        }
        this.standardLibraryProxy = standardLibraryProxy;
        this.redisInviteManager = redisInviteManager;
        this.heartBeatUpdate();
    }

    public updateAllPlayers() {
        if (this.playerCount() > 0) { //I don't think its a bug to call updateAllPlayers if there are no players, so I will keep doing this check
            let message: I.MessagePlayers = {
                command: "updateGameInfo",
                players: this.getPlayers(),
                body: this.stringifyForClients(),
                next: () => { },
            };
            EventBus.emit('Message Players', message);
        }// else {
        //   try {
        //       throw new Error("Not updating players, because there are not players!, full error is");
        //   } catch (e) {
        //       console.log(e.stack);
        //   }
        //}
    }

    private heartBeatUpdate() {
        setTimeout(() => {
            if (this.isStateBeforeStarted()) {
                this.updateAllPlayers();
                this.heartBeatUpdate();
            }
        }, 5 * 1000);
    }

    public createGameListing() {
        if (this.isStateJoinable()) {
            return {
                gameName: this.gameName,
                mapName: this.mapName,
                gameType: this.gameType,
                numOfPlayers: this.playerCount(),
                hostName: this.getHost().player.getName(),
                gameGUID: this.gameGUID
            }
        } else {
            return null;
        }
    }
    private pushLobbyListing() {
        if (
            this.status == enums.LobbyInfoState.TeamSelect
            && this.players
            && (this.playerCount() > 0)
            && this.getHost(true)
            ) {

            let lobbyListing: I.LobbyListing = {
                gameName: this.gameName,
                mapName: this.mapName,
                gameType: this.gameType,
                numOfPlayers: this.team1Count() + this.team2Count(),
                maxPlayers: this.teamMaxSize * 2,
                hostName: this.getHost().player.getName(),
                gameGUID: this.gameGUID,
                port: settings.socketServerPort.toString(),
                host: settings.callbackBaseURL,
                httpEndpoint: Lobby.buildHttpEndpoint()
            };

            LobbyListing.addOrUpdate(lobbyListing)
                .catch((err) => {
                    logger.warn("Failed to add lobby to redis", { codepath: "Lobby.pushLobbyListing", gameGUID: this.gameGUID, err: err, errMessage: err.message });
                })
                .done();
        }
    }
    private removeLobbyListing() {
        LobbyListing.remove(this.gameGUID)
            .catch((err) => {
                logger.warn("Failed to remove lobby from redis", { codepath: "Lobby.removeLobbyListing", gameGUID: this.gameGUID, err: err, errMessage: err.message });
            })
            .done();
            this.redisInviteManager.removeInvites(this.invites).done();
    }

    public processStarted(gameStartInfo: I.GameStartInfo) {
        if (this.isStateBeforeStarting()) {
            logger.warn("Lobby got a process started but its state is before starting, so ignoring the processStarted", { codepath: "Lobby.processDied", gameGUID: this.gameGUID, gameStartInfo: gameStartInfo });
        } else {
            this.stateInGame();
            this.connectionInfo = gameStartInfo.connectionInfo;

            let timeToStartSec = (Date.now() - this.lobbyStartMatchTime) / 1000;
            logger.info("Lobby has started", { codepath: "Lobby.processStarted", gameGUID: this.gameGUID, jobID: gameStartInfo.jobID, numOfPlayers: this.playerCount(), gameType: this.gameType, mapName: this.mapName, timeToStartSec: timeToStartSec, self: this.stringifyForClients() });
        }
        this.updateAllPlayers();
    }
    public processFailedToStart() {
        this.stateBackToTeamSelect();

        //this.removeAllPlayers();
        this.updateAllPlayers();
    }

    public playerDisconnected(playerUniqueName: string) {
        if (this.isStateBeforeStarted()) {
            logger.info("Lobby.playerDisconnected: Disconnected before game has started, removing player", { codepath: "Lobby.playerDisconnected", playerUniqueName: playerUniqueName, gameGUID: this.gameGUID });
            EventBus.emit("Cancel Start Game", this.gameGUID);
            this.removePlayer(playerUniqueName);
            this.updateAllPlayers();
        }
        else {
            logger.info("Lobby.playerDisconnected: Disconnected after game has started", { codepath: "Lobby.playerDisconnected", playerUniqueName: playerUniqueName, gameGUID: this.gameGUID });
        }
    }

    //This does everything to remove a player
    private removePlayer(playerUniqueName: string) {
        if (this.players[playerUniqueName].isHost()) {
            this.players[playerUniqueName].host = false; //Kludge so that we always kill lobby if is host, calls back to this function
            this.stateCancelled();
            this.updateAllPlayers();
            this.removeAllPlayers();
            EventBus.emit("Delete Lobby", this.gameGUID);
            EventBus.emit("Cancel Start Game", this.gameGUID);
        } else {
            let player = this.players[playerUniqueName].player;
            delete this.players[playerUniqueName];
            this.stateBackToTeamSelect(); //This also updates the lobby listing
            if (this.status == enums.LobbyInfoState.GameStarting && this.lobbyStartMatchTime) {
                let timeToStartSec = (Date.now() - this.lobbyStartMatchTime) / 1000;
                logger.info("Player left while game was starting", { codepath: "Lobby.removePlayer", gameGUID: this.gameGUID, playerName: player.uniqueName, timeSpentWaiting: timeToStartSec });
            }

            delete player.connectionKey;
            if (player.currentSocket) {
                player.currentSocket.destroy();
                delete player.currentSocket;
                logger.info("Removed Player.", { codepath: "Lobby.removePlayer", playerUniqueName: playerUniqueName, gameGUID: this.gameGUID });
            }
        }
    }

    public addPlayerToLobby(player: Player) {
        this.players[player.uniqueName] = this.players[player.uniqueName] || new LobbyPlayer(player, this.autoChooseTeam());
        player.connectionKey = uuid.v4();
        logger.info("Player has been added to lobby", { codepath: "Lobby.addPlayertoLobby", playerName: player.getName(), gameGUID: this.gameGUID });
    }

    public playerConnected(player: Player) {
        if (!this.players[player.uniqueName]) {
            this.addPlayerToLobby(player);
        } else if (this.players[player.uniqueName].isHost()) {
            this.players[player.uniqueName].player = player;
        }
        this.pushLobbyListing();
        this.updateAllPlayers();
    }

    private setConnectionTimeout(playerUniqueName: string) {
        let myThis = this;
        setTimeout(() => {
            if (myThis.isStateBeforeStarted()) {
                let lobbyPlayer = myThis.players[playerUniqueName];
                if (lobbyPlayer && lobbyPlayer.player && !lobbyPlayer.player.currentSocket) {
                    logger.warn("User never joined game within 10 seconds (or has since left), kicking user.", { codepath: "Lobby.setConnectionTimeout", playerUniqueName: playerUniqueName, gameGUID: this.gameGUID });
                    myThis.removePlayer(playerUniqueName);
                }
            }
        }, 1 * 10 * 1000);
    }

    //NEED TO MALE THE FUNCTUIONS EXPLICIT SOMEHWERE
    //Really, need to update routing overall...
    handleClientCalls(func: string, lobbyCommandParameters: any, playerUniqueName: string, next: (err: Error, response: string) => void): any {
        if (!(<any>this)[func]) {
            //logger.warn("No such function exists (client function handler)", { codepath: "Lobby.handleClientCalls", func: func, playerName: player.getName(), gameGUID: player.currentGameGUID});
            next(new Error("Lobby.handleClientCalls: No such function exists: " + func), null);
            return;
        }
        let player: Player;
        if (func != 'joinLobby') {
            let lobbyPlayer = this.players[playerUniqueName];
            if (!lobbyPlayer) {
                return next(new Error("Lobby.handleClientCalls: Player not found in game"), null);
            }
            player = lobbyPlayer.player;
        }

        let err: Error = null;
        let result: any = null;
        try {
            result = (<any>this)[func].call(this, player, lobbyCommandParameters);
            if (typeof (result) != "string") {
                result = this.stringifyForClients(); //This is since the API sometimes expects these functions to return the status of lobby... Could put this at each function, but it is a useful thing to do
            }
        } catch (error) {
            err = error;
        }
        this.updateAllPlayers();
        next(err, result);
    }
    /*
     * Functions players can call
     */
    public updateLobbyInfo() {/*Intentionally blank, this stub causes everyone to get an update and status to be returned*/ }
    public joinLobby() {
        //Deprecated code for now!
        this.assertLobbyIsNotFull();
        this.assertIsStateJoinable();

        return JSON.stringify({
            gameName: this.gameName,
            mapName: this.mapName,
            gameType: this.gameType,
            numOfPlayers: this.playerCount(),
            connectionKey: "dummyConnectionKey"
        });
    }
    public startMatch(player: Player) {
        this.assertPlayerIsInLobby(player);
        this.assertPlayerIsHost(player);
        this.assertIsBeforeStateStarting();
        this.assertAllPlayersAreConnected();

        this.stateStarting();
        EventBus.emit("Start ProcessInfo", this.createProcessInfo());
    }
    public changeMap(player: Player, lobbyCommandParameters: any) {
        this.assertPlayerIsInLobby(player);
        this.assertPlayerIsHost(player);
        this.assertIsString(lobbyCommandParameters);

        this.mapName = lobbyCommandParameters;
        this.pushLobbyListing();
    }
    public changeGameType(player: Player, lobbyCommandParameters: any) {
        this.assertPlayerIsInLobby(player);
        this.assertPlayerIsHost(player);
        this.assertIsString(lobbyCommandParameters);

        this.gameType = lobbyCommandParameters;
        this.pushLobbyListing();
    }
    public lockTeams(player: Player) {
        this.assertPlayerIsInLobby(player);
        this.assertPlayerIsHost(player);
        if (this.status !== enums.LobbyInfoState.TeamSelect) {
            throw new Error("Can't lock teams, state is not team select");
        }   
        if (!this.hasNonSpectatorHumanPlayers()) {
            throw new Error("Can't lock teams without a human player on either team");
        }

        this.stateCommanderSelect();
        this.selectCommandersForBots();
        this.setBotsToLocked();
        this.commanderSelectStartTime = this.standardLibraryProxy.getTime();
        this.timeoutTimer = this.standardLibraryProxy.setTimeout(() => {
            if (this.status == enums.LobbyInfoState.CommanderSelect) {
                this.stateBackToTeamSelect();
            }
        }, settings.lobbyTimeoutInMs + settings.lobbyTimeoutBufferInMs);
    }

    private selectCommandersForBots() {
        for (let i in this.players) {
            if (this.players[i].isBot) {
                let commanderToSelect: string;
                commanderToSelect = settings.commandersForBotsToSelect[this.standardLibraryProxy.randomInt(settings.commandersForBotsToSelect.length)];
                this.players[i].commanderSelected = commanderToSelect;
            }
        }
    }
    private setBotsToLocked() {
        for (let i in this.players) {
            if (this.players[i].isBot) {
                this.players[i].commanderSelectState = enums.CommanderSelectStatus.Locked;
            }
        }
    }
    public lockCommander(player: Player) {
        this.assertPlayerIsInLobby(player);
        if (!this.players[player.uniqueName].isCommanderSelected()) {
            throw new Error("No commander selected, cannot lock commander");
        }

        this.players[player.uniqueName].lockCommanderSelect();
        this.startIfAllLocked();
    }
    public chooseCommander(player: Player, lobbyCommandParameters: any) {
        this.assertPlayerIsInLobby(player);
        this.assertIsString(lobbyCommandParameters);
        if (this.players[player.uniqueName].isCommanderSelectLocked()) {
            throw new Error("commander select is locked, cannot select commander");
        }

        this.players[player.uniqueName].selectCommander(lobbyCommandParameters);
    }
    public switchTeams(player: Player, lobbyCommandParameters: any) {
        this.assertPlayerIsInLobby(player);
        if (lobbyCommandParameters) {
            let teamNumber = parseInt(lobbyCommandParameters);
            this.assertTeamNumberIsValid(teamNumber);

            if (!this.isTeamFull(teamNumber)) {
                this.players[player.uniqueName].setTeam(teamNumber);
            } else {
                throw new Error("Cannot switch teams, Team " + teamNumber + " is full");
            }
            this.pushLobbyListing(); //So that spectators don't count towards player count
        } else { //Temporarily left in until andre implements team selection. Should be removed after ~3/3/14, unless we have old versions laying around...)
            throw new Error("Cannot switch teams, Game version too old");
        }
    }

    public hasNonSpectatorHumanPlayers(): boolean {
        for (let index in this.players) {
            let lobbyPlayer: LobbyPlayer = this.players[index];

            if (lobbyPlayer.isBot) {
                continue;
            }

            if (lobbyPlayer.teamNumber == 1 || lobbyPlayer.teamNumber == 2) {
                return true;
            }
        }

        return false;
    }

    public kickPlayer(player: Player, lobbyCommandParameters: any) {
        this.assertIsString(lobbyCommandParameters);
        this.assertPlayerIsHost(player);
        this.removePlayer(Player.getUniqueNameFromPlayerName(lobbyCommandParameters));
        this.updateAllPlayers();
    }

    public addBot(player: Player, lobbyCommandParametersString: any) {
        let lobbyCommandParameters = JSON.parse(lobbyCommandParametersString);
        this.assertTeamNumberIsValid(lobbyCommandParameters.teamNumber);
        this.assertIsString(lobbyCommandParameters.playerName);
        this.assertIsValidBotDifficulty(lobbyCommandParameters.botDifficulty);
        this.assertPlayerIsHost(player);
        if (this.isTeamFull(lobbyCommandParameters.teamNumber)) {
            return;
        }
        let botUniqueName: string = Player.getUniqueNameFromPlayerName(lobbyCommandParameters.playerName);
        let botPlayer: Player = new Player(lobbyCommandParameters.playerName);
        let botLobbyPlayer: LobbyPlayer = new LobbyPlayer(botPlayer, lobbyCommandParameters.teamNumber);
        botLobbyPlayer.botDifficulty = lobbyCommandParameters.botDifficulty;
        botLobbyPlayer.isBot = true;
        this.players[botUniqueName] = this.players[botUniqueName] || botLobbyPlayer;
        this.updateAllPlayers();
        logger.info("Bot has been added to lobby", { codepath: "Lobby.addPlayertoLobby", playerName: botPlayer.getName(), gameGUID: this.gameGUID });
    }

	public changeBotDifficulty(player: Player, lobbyCommandParametersString: any) {
		let lobbyCommandParameters = JSON.parse(lobbyCommandParametersString);
		this.assertIsString(lobbyCommandParameters.playerName);
		this.assertIsValidBotDifficulty(lobbyCommandParameters.botDifficulty);
		this.assertPlayerIsHost(player);

		let botUniqueName: string = Player.getUniqueNameFromPlayerName(lobbyCommandParameters.playerName);
		if (!this.players[botUniqueName]) {
			return
		}
		if (!this.players[botUniqueName].isBot) {
			return
		}
		this.players[botUniqueName].botDifficulty = lobbyCommandParameters.botDifficulty

		this.updateAllPlayers();
	}

    /*
     *   Utility Functions
     */
    private startIfAllLocked() {
        let allLocked: boolean = true;
        for (let index in this.players) {
            if (!(this.players[index].isCommanderSelectLocked() || this.players[index].isSpectator())) {
                allLocked = false;
            }
        }

        if (allLocked) {
            this.stateStarting();
            EventBus.emit("Start ProcessInfo", this.createProcessInfo());
        }
    }

    private generateAiPlayers() {
        let aiPlayers: Array<I.AiPlayer> = [];
        for (let i in this.players) {
            if (this.players[i].isBot) {
                aiPlayers.push({
                    allyId: this.players[i].teamNumber - 1,
                    botDifficulty: this.players[i].botDifficulty,
                    commanderName: this.players[i].commanderSelected,
                    playerName: this.players[i].player.getName()
                });
            }
        }
        return aiPlayers;
    }

    public createProcessInfo(): I.ProcessInfo {
        let activePlayerCount: number = 0;
        for (let i in this.players) {
            if (!this.players[i].isBot && !this.players[i].isSpectator()) {
                activePlayerCount++;
            }
        }
        let result: I.ProcessInfo = {
            activePlayerCount: activePlayerCount,
            settings: { mapName: this.mapName, gameType: this.gameType, aiPlayers: this.generateAiPlayers() },
            gameGUID: this.gameGUID
        }
        this.lobbyStartMatchTime = Date.now();
        logger.info("Process info created from lobby", { codepath: "Lobby.createProcessInfo", gameGUID: this.gameGUID, lobby: this.stringifyForClients() });
        return result;
    }

    public canPlayerConnect(uniqueName: string): boolean {
        if (this.players[uniqueName]) {
            return true;
        } else if (this.isStateJoinable() && this.playerCount() < settings.maxPlayersInLobby) { //TODO: fix this for when playerinlobby is no longer in config but per lobby
            return true;
        }
        else {
            logger.info("A player tried to join a full or non joinable game", { codepath: "Lobby.canPlayerConnect", playerName: uniqueName, gameGUID: this.gameGUID, lobby: this.stringifyForClients() });
            return false;
        }
    }

    private removeAllPlayers() {
        for (let index in this.players) {
            this.removePlayer(this.players[index].player.uniqueName);
        }
    }

    public addSteamLobbyInvite(steamLobbyInvite: I.SteamInvite) {
        this.invites.push(steamLobbyInvite);
    }

    private stateBackToTeamSelect() {
        this.stateTeamSelect();
        for (let index in this.players) {
            this.players[index].resetCommanderSelection();
        }
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
        }
    }
    private stateStarting() {
        this.status = enums.LobbyInfoState.GameStarting;
        this.removeLobbyListing();
    }
    private stateCommanderSelect() {
        this.status = enums.LobbyInfoState.CommanderSelect;
        this.removeLobbyListing();
    }
    private stateInGame() {
        this.status = enums.LobbyInfoState.InGame;
        this.removeLobbyListing();
    }
    private stateTeamSelect() {
        //Cannot use for constructor since we need at lesast one user in the game
        this.status = enums.LobbyInfoState.TeamSelect;
        this.pushLobbyListing();
    }
    private stateCancelled() {
        this.status = enums.LobbyInfoState.GameCanceled;
        this.removeLobbyListing();
    }

    public isStateJoinable(): boolean {
        if (this.status == enums.LobbyInfoState.TeamSelect) {
            return true;
        } else {
            return false;
        }
    }
    private isStateBeforeStarted(): boolean {
        if (this.status != enums.LobbyInfoState.InGame && this.status != enums.LobbyInfoState.GameEnded && this.status != enums.LobbyInfoState.GameCanceled) {
            return true;
        } else {
            return false;
        }
    }
    private isStateBeforeStarting(): boolean {
        if (this.status != enums.LobbyInfoState.InGame && this.status != enums.LobbyInfoState.GameEnded && this.status != enums.LobbyInfoState.GameCanceled && this.status != enums.LobbyInfoState.GameStarting) {
            return true;
        } else {
            return false;
        }
    }

    private assertIsBeforeStateStarting() {
        if (!this.isStateBeforeStarting()) {
            throw new Error("Lobby is already starting or started");
        }
    }
    private assertIsStateJoinable() {
        if (!this.isStateJoinable()) {
            throw new Error("Lobby state is not a joinable state");
        }
    }
    private assertLobbyIsNotFull() {
        if (this.playerCount() >= settings.maxPlayersInLobby) {
            throw new Error("Lobby is full");
        }
    }
    private assertPlayerIsInLobby(player: Player) {
        if (!this.players[player.uniqueName])
            throw new Error("Player is not in this lobby");
    }
    private assertPlayerIsHost(player: Player) {
        if (!this.players[player.uniqueName].isHost())
            throw new Error("Player is not host");
    }

    private assertIsValidBotDifficulty(botDifficulty: any) {
        if (botDifficulty !== enums.BotDifficulty.Beginner &&
            botDifficulty !== enums.BotDifficulty.Intermediate) {
            throw new Error("value for botDifficulty was not recognized");
        }
    }
    private assertIsString(str: string) {
        if (typeof (str) != "string")
            throw new Error("An expected argument does not exist or is not a string");
    }
    private assertAllPlayersAreConnected() {
        let allConnected: boolean = true;
        for (let index in this.players) {
            if (this.players[index].player.currentSocket === undefined) {
                throw new Error("Not all players are connected");
            }
        }
    }
    private assertTeamNumberIsValid(teamNumber: number) {
        if (!(teamNumber === 1 || teamNumber === 2 || teamNumber === 3))
            throw new Error("Invalid team number: " + teamNumber);
    }

    private getPlayers(): Player[] {
        let players = [];
        for (let index in this.players) {
            players.push(this.players[index].player);
        }
        return players;
    }
    private getPlayersHash(): { [playerName: string]: Player } {
        let players: { [playerName: string]: Player } = {};
        for (let index in this.players) {
            players[index] = (this.players[index].player);
        }
        return players;
    }
    private getHost(surpressLoggingError?: boolean): LobbyPlayer {
        for (let index in this.players) {
            if (this.players[index].isHost()) {
                return this.players[index];
            }
        }
        if (!surpressLoggingError) {
            debugger;
            logger.error("No host... There should always be a host", { codepath: "Lobby.getHost", numOfPlayers: this.playerCount(), gameGUID: this.gameGUID });
        }
        return null;
    }
    private playerCount(): number {
        return Object.keys(this.players).length;
    }
    private autoChooseTeam(): number {
        if (!this.isTeamFull(1) || !this.isTeamFull(2)) {
            if (this.team2Count() >= this.team1Count()) {
                return 1;
            } else {
                return 2;
            }
        } else {
            return 3;
        }
    }
    private team1Count(): number {
        let count = 0;
        for (let index in this.players) {
            if (this.players[index].teamNumber == 1) {
                count++;
            }
        }
        return count;
    }
    private team2Count(): number {
        let count = 0;
        for (let index in this.players) {
            if (this.players[index].teamNumber == 2) {
                count++;
            }
        }
        return count;
    }
    private isTeamFull(teamNumber: number): boolean {
        if (teamNumber == 2) {
            return (this.team2Count() >= this.teamMaxSize);
        } else if (teamNumber == 1) {
            return (this.team1Count() >= this.teamMaxSize);
        } else {
            return false;
        }
    }

    public stringifyForClients(): string {
        return JSON.stringify(this);
    }

    //DON't CHANGE THIS without also changing stringifyForClients
    public toJSON(): {} {

        if (this.connectionInfo && this.connectionInfo.publicPort) {
            this.connectionInfo.publicPort = String(this.connectionInfo.publicPort);
        }
        
        let host: string;
        try {
            host = this.getHost(true).player.getName();
        } catch (e) {
            host = null;
        }
        
        let commanderSelectTimeRemaining: number = Lobby.INVALID_TIME_REMAINING;
        if (this.status == enums.LobbyInfoState.CommanderSelect) {
            let currentTime: number = new Date().getTime();
            let timePassed = currentTime - this.commanderSelectStartTime;
            commanderSelectTimeRemaining = settings.lobbyTimeoutInMs - timePassed;
            if (commanderSelectTimeRemaining < 0) {
                commanderSelectTimeRemaining = Lobby.INVALID_TIME_REMAINING;
            }
        }

        let players: Array<I.UpdateGameInfoResponsePlayer> = [];
        for (let index in this.players) {
            players.push({
                playerName: this.players[index].player.getName(),
                commanderSelected: this.players[index].commanderSelected,
                commanderSelectState: enums.CommanderSelectStatus[this.players[index].commanderSelectState].toString(),
                teamNumber: this.players[index].teamNumber,
                isBot: this.players[index].isBot,
                botDifficulty: this.players[index].botDifficulty
            });
        }

        let result: I.UpdateGameInfoResponse = {
            gameGUID: this.gameGUID,
            gameName: this.gameName,
            gameType: this.gameType,
            mapName: this.mapName,
            numOfPlayers: this.playerCount(),
            endpoint: this.connectionInfo,
            status: enums.LobbyInfoState[this.status].toString(),
            host: host,
            commanderSelectTimeRemaining: commanderSelectTimeRemaining, //-1 default when not in commanderSelect
            players: players
        };

        return result;
    }

}

export = Lobby;
