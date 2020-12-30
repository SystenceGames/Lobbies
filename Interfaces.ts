import net = require('net');
import Player = require('./models/Player');

export interface PlatformMOTDResponse {
    MOTD: string;
    featureToggles: any;
}

export interface Job {
    jobID: string;
    processInfo: ProcessInfo;
    callbackURL: string;
}
export interface AiPlayer {
    botDifficulty: number;
    playerName: string;
    commanderName: string;
    allyId: number;
}
export interface ProcessInfo {
    settings: { mapName: string; gameType: string; aiPlayers?: Array<AiPlayer> };
    activePlayerCount: number;
    gameGUID: string;
}
//export interface IEndpoint {
//    publicPort: number;
//    privatePort: number;
//}
//export interface IServerSlot extends IEndpoint {
//    status: Enums.ServerSlotStatus;
//    killTimer?: NodeJS.Timer;
//    tagged?: boolean;
//}
export interface ConnectionInfo {
    serverHostName: string;
    publicPort: string;
}
export interface GameStartInfo {
    gameGUID: string;
    jobID: string;
    connectionInfo?: ConnectionInfo;
}

//export interface IProcessStatus {
//    gameGUID?: string;
//    jobID: string;
//    pid: string;
//    privatePort?: string;
//}
export interface Graylog2 {
    graylogHost: string;
    graylogPort: number;
    graylogFacility: string;
    level: string;
}

export interface Settings {
    httpDirectPort: number;
    httpLoadBalancedPort: number;
    socketServerPort: number;
    queueURL: string;
    callbackBaseURL: string;
    redis_port: number;
    redis_address: string;
    redis_password: string;
    lobbyListingsUpdateFrequency: number;
    redisLobbyInactiveTimeout: number;
    eventBusMessagesToNotLog: Array<string>;
    jobQueueName: string;
    defaultMapName: string;
    maxPlayersInLobby: number;
    JWTSecret: string;
    sslConfigPath: string;
    lobbyTimeoutInMs: number;
    lobbyTimeoutBufferInMs: number;
    Graylog2: Graylog2;
    commandersForBotsToSelect: Array<string>;
    redisSteamInviteExpireInSeconds: number;
    platformStatusUpdateFrequencyMillis: number;
    useGraylog: boolean;
	logMorgan: boolean;
	mongoDbUsername: string;
	mongoDbPassword: string;
	mongoDbUris: Array<string>;
	mongoDbReplicaSet: string;
	mongoDbName: string;
	mongoDbKeepAlive: number;
	mongoDbReconnectTries: number;
    mongoDbReconnectIntervalMillis: number;
    forceDefaultMapOnLobbyStart: string;
}
//
//export interface IGameServerStatus {
//    isEnabled: boolean;
//    needsPatching: boolean;
//    isPatching: boolean;
//    slots: IServerSlot[];
//    settings: ISettings;
//}

export interface StandardLibraryProxy {
    randomInt(max: number): number;
    setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timer;
    getTime(): number;
    getCurrentDate(): Date;
}

export interface LobbyListing {
    gameName: string;
    mapName: string;
    gameType: string;
    numOfPlayers: number;
    maxPlayers: number;
    hostName: string;
    gameGUID: string;
    port: string;
    host: string;
    httpEndpoint: string;
}

export interface PlayerConnectedMessage {
    playerName: string;
    gameGUID: string;
    socket: net.Socket;
}
export interface MessagePlayers {
    command: string;
    players: Array<Player>;
    body: string;
    next: Function;
}

export interface UpdateGameInfoResponse {
    gameGUID: string;
    gameName: string;
    gameType: string;
    mapName: string;
    numOfPlayers: number;
    endpoint: ConnectionInfo;
    status: string;
    host?: string;
    commanderSelectTimeRemaining: number;
    players: Array<UpdateGameInfoResponsePlayer>;
}

export interface UpdateGameInfoResponsePlayer {
    playerName: string;
    commanderSelected: string;
    commanderSelectState: string;
    teamNumber: number;
    isBot: boolean;
    botDifficulty: number;
}

export interface SteamInvite {
    receiverSteamId: number;
    senderSteamId: number;
    senderPlayerName: string;
    gameGUID: string;
    port: number;
    httpEndpoint: string;
    host: string;
}

export interface SendSteamInviteRequest {
    receiverSteamId: number;
    senderSteamId: number;
    senderPlayerName: string;
    gameGUID: string;
    port: number;
    host: string;
    httpEndpoint: string;
}

export interface SendSteamInviteResponse {
    success: boolean;
}

export interface RetrieveSteamInvitesRequest {
    receiverSteamId: number;
    sessionToken: string;
    playerName: string;
}

export interface RetrieveSteamInviteResponse {
    steamLobbyInvites: Array<SteamInvite>;
}

export interface AcceptSteamInviteRequest {
    receiverSteamId: number;
    senderSteamId: number;
    senderPlayerName: string;
    gameGUID: string;
    port: number;
    host: string;
    httpEndpoint: string;
}

export interface AcceptSteamInviteResponse {
    success: boolean;
}

export interface RedisClientWrapper {
   multi(args: Array<any>): Q.Promise<any>;
    lrange(key: string, headIndex: number, tailIndex: number): Q.Promise<Array<string>>;
    lrem(key: string, count: number, value: string): Q.Promise<number>;
    get(key: string, callback: (err: Error, res: string) => void): boolean;
}

export interface RedisInviteManager {    
    addInvite(steamLobbyInvite: SteamInvite): Q.Promise<any>;
    removeInvite(steamLobbyInvite: SteamInvite): Q.Promise<number>;
    steamInvitesFor(receiverSteamId: number): Q.Promise<Array<SteamInvite>>;
    removeInvites(steamLobbyInvites: Array<SteamInvite>): Q.Promise<any>;
}

export interface MatchManager {
    addSteamLobbyInvite(steamLobbyInvite: SteamInvite): boolean;
}

export interface PlatformStatus {
	motd: string;
	featureTogglesString: string;
}

export interface PlatformStatusDb {
	init(): void;
	createNewPlatformStatus(motd: string, featureTogglesString: string): Q.Promise<PlatformStatus>;
	getPlatformStatus(): Q.Promise<PlatformStatus>;
	setMotd(motd: string): Q.Promise<void>;
	setFeatureTogglesString(featureTogglesString: string): Q.Promise<void>;
}