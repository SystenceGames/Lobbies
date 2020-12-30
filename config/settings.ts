import nconf = require('nconf');
import I = require('../Interfaces');

class Settings implements I.Settings {
    get httpDirectPort(): number {
        return Number(nconf.get('http_direct_port'));
    }
    get httpLoadBalancedPort(): number {
        return Number(nconf.get('http_load_balanced_port'));
    }
    get socketServerPort(): number {
        return Number(nconf.get('socket_server_port'));
    }
    get queueURL(): string {
        return nconf.get('queue_url');
    }
    set queueURL(newValue: string) {
        nconf.set('queue_url', newValue);
    }
    get callbackBaseURL(): string {
        return nconf.get('callback_base_url');
    }
    get redis_port(): number {
        return nconf.get('redis_port');
    }
    set redis_port(newValue: number) {
        nconf.set('redis_port', newValue);
    }
    get redis_address(): string {
        return nconf.get('redis_address');
    }
    set redis_address(newValue: string) {
        nconf.set('redis_address', newValue);
    }
    get redis_password() {
        return nconf.get('redis_password');
    }
    set redis_password(newValue: string) {
        nconf.set('redis_password', newValue);
    }
    get lobbyListingsUpdateFrequency(): number {
        return Number(nconf.get('lobbyListingsUpdateFrequency'));
    }
    get redisLobbyInactiveTimeout(): number {
        return Number(nconf.get('redisLobbyInactiveTimeout'));
    }
    get eventBusMessagesToNotLog(): Array<string> {
        return nconf.get('eventBusMessagesToNotLog') as Array<string>;
    }
    get jobQueueName(): string {
        return nconf.get('jobQueueName');
    }
    get defaultMapName(): string {
        return nconf.get('defaultMapName');
    }
    get maxPlayersInLobby(): number {
        return nconf.get('maxPlayersInLobby');
    }
    get JWTSecret(): string {
        return nconf.get('JWTSecret');
    }
    get sslConfigPath(): string {
        return nconf.get('sslConfigPath');
    }
    get lobbyTimeoutInMs(): number {
        return nconf.get('lobbyTimeoutInMs');
    } 
    get lobbyTimeoutBufferInMs(): number {
        return nconf.get('lobbyTimeoutBufferInMs');
    } 
    get Graylog2(): I.Graylog2 {
        return nconf.get('Graylog2') as I.Graylog2;
    }
    get commandersForBotsToSelect(): Array<string> {
        return nconf.get('commandersForBotsToSelect');
    }
    get redisSteamInviteExpireInSeconds(): number {
        return nconf.get('redisSteamInviteExpireInSeconds');
    }
    get platformStatusUpdateFrequencyMillis(): number {
        return nconf.get('platformStatusUpdateFrequencyMillis');
    }
    get useGraylog(): boolean {
        return nconf.get('useGraylog');
    }
    get logMorgan(): boolean {
        return nconf.get('logMorgan');
	}
	get mongoDbUsername(): string {
		return nconf.get('mongoDbUsername');
	}
	get mongoDbPassword(): string {
		return nconf.get('mongoDbPassword');
	}
	get mongoDbUris(): Array<string> {
		return nconf.get('mongoDbUris');
	}
	get mongoDbReplicaSet(): string {
		return nconf.get('mongoDbReplicaSet');
	}
	get mongoDbName(): string {
		return nconf.get('mongoDbName');
	}
	get mongoDbKeepAlive(): number {
		return nconf.get('mongoDbKeepAlive');
	}
	get mongoDbReconnectTries(): number {
		return nconf.get('mongoDbReconnectTries');
	}
	get mongoDbReconnectIntervalMillis(): number {
		return nconf.get('mongoDbReconnectIntervalMillis');
    }
    get forceDefaultMapOnLobbyStart(): string {
        return nconf.get('forceDefaultMapOnLobbyStart');
    }
}

let defaultSettings = {
    queue_url : "amqp://127.0.0.1",
    callback_base_url : '127.0.0.1',
    http_load_balanced_port: 10000,
    http_direct_port : 10200,
    socket_server_port : 10100,
    redis_address : '127.0.0.1',
    redis_port : 6379,
    redis_password: '',
    lobbyListingsUpdateFrequency: 2 * 1000, // in ms
    redisLobbyInactiveTimeout: 2 * 60 * 60, //in seconds
    eventBusMessagesToNotLog: new Array<string>(),
    jobQueueName: 'jobs:local',
    defaultMapName: "SacredArena",
    maxPlayersInLobby: 8,
    JWTSecret: "strongJwtSecretGoesHere",
    sslConfigPath: "./config/ssl.json",
    lobbyTimeoutInMs: 60000,
    lobbyTimeoutBufferInMs: 2000,
    Graylog2: {
        name: "Graylog",
        level: "debug",
        graylog: {
            servers: [{
                host: "analytics.beta.maestrosgame.com",
                port: 12201
            }],
            facility: "Lobbies",
        },
        staticMeta: { shard: 'local' }
    },
    commandersForBotsToSelect: [
        "Rosie",
        "TinkerMeister",
        "RoboMeister"
    ],
    redisSteamInviteExpireInSeconds: 15 * 60,
    platformStatusUpdateFrequencyMillis: 1 * 1000,
    useGraylog: false,
	logMorgan: true,
	mongoDbUsername: "",
	mongoDbPassword: "",
	mongoDbUris: ["127.0.0.1:27017"],
	mongoDbReplicaSet: "",
	mongoDbName: "PlatformStatus",
	mongoDbKeepAlive: 1,
	mongoDbReconnectTries: 600,
    mongoDbReconnectIntervalMillis: 1000
}

nconf.file('./config/settings.json')
     .defaults(defaultSettings);

let settings: I.Settings = new Settings();
export = settings;