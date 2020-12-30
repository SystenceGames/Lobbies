import http = require('http');
import url = require('url');
import net = require('net');
import stream = require('stream')
import I = require('./Interfaces');
import settings = require('./config/settings');
import EventBus = require('./EventBus');
import Player = require('./models/Player');
import logger = require('./logger');
import MatchManager = require('./MatchManager');
import SplitStreamOnNewJSON = require('./SplitStreamOnNewJSON');

http.globalAgent.maxSockets = 64;
class PlayerCommunicator {
    private messageSplitBuffer = new Buffer('17', 'hex');
    private socketServer: net.Server;
    private matchManager: MatchManager;

    constructor(matchManager: MatchManager) {
        this.matchManager = matchManager;
    }

    public init() {
        this.socketServer = this.createSocketServer();
        EventBus.on('Message Players', (message: I.MessagePlayers) => {
            this.messageClients(message.command, message.players, message.body, message.next);
        });
    }

    private createSocketServer(): net.Server {
        let socketServer = net.createServer((socket: net.Socket) => {
            socket.setNoDelay(true);
            socket.setKeepAlive(true, 50 * 1000);

            let playerUniqueName: string;
            let gameGUID: string;
            let connected = false;

            let splitter = new SplitStreamOnNewJSON();
            socket.on('data', (data: any) => {
                console.log("socket data:");
                console.log(data);
                splitter.lookForJSON(data);
            });

            splitter.on('data', (chunk: any) => {
                let obj: any = null;
                try {
                    obj = JSON.parse(chunk);
                    console.log("scraper Data:");
                    console.log(obj);
                if (!connected || !gameGUID) {
                        gameGUID = obj["gameGUID"];
                        playerUniqueName = this.onPlayerConnection(socket, JSON.stringify(obj));
                        connected = true;
                    } else {
                        let method = obj["method"];
                        let params = obj["params"];
                        this.matchManager.callLobby(gameGUID, method, params, playerUniqueName, (err, response) => {
                            this.messageClient(err, response, socket);
                        });
                    }
                } catch (err) {
                    this.messageClient(err, null, socket);
                    socket.end();
                    logger.error("Player connection error", { codepath: "PlayerCommunicator.createSocketServer", message: obj, messageRaw: chunk, error: err });
                }
            });

            socket.on('end', () => {
                splitter.removeAllListeners();
            });

            socket.on('error', function (e) {
                splitter.removeAllListeners();
            });

        });
        //From the node docs http://nodejs.org/api/net.html
        socketServer.on('error', function (e: any) {
            logger.error("Error creating socket server", { codepath: "PlayerCommunicator.createSocketServer", error: e });
            if (e.code == 'EADDRINUSE') {

                setTimeout(function () {
                    socketServer.close();
                    socketServer.listen(settings.socketServerPort);
                }, 1000);
            }
        });
        socketServer.listen(settings.socketServerPort);
        console.log("Socket Server listening at port " + settings.socketServerPort);
        return socketServer;
    }

    private onPlayerConnection(socket: net.Socket, message: string):string {
        let gameGUID: string = JSON.parse(message)["gameGUID"];
        let playerName: string = JSON.parse(message)["playerName"];
        let connectionKey: string = JSON.parse(message)["connectionKey"];

        let uniqueName = Player.assertCorrectConnectionKeyAndGetUniqueName(playerName, connectionKey);
        EventBus.emit("Player Connected", { playerName: playerName, gameGUID: gameGUID, socket: socket });
        return uniqueName;
    }

    private messageClient(err: Error, resultAsStringifiedJSON: string, socket: net.Socket) {
        let message = JSON.stringify({
            error: err,
            result: JSON.parse(resultAsStringifiedJSON)
        }) + '\n';
        socket.write(Buffer.concat([new Buffer(message, 'ascii'), this.messageSplitBuffer]));
    }

    private messageClients(command: string, players: Player[], body: string, next: Function) {
        let message = JSON.stringify({
            command: command,
            body: JSON.parse(body)
        }) + '\n';

        function writeTo(socket: any, message: any, callback: any) {
            socket.write(message, callback);
        }

        let count = 0;
        players.forEach((player, index, array) => {
            if (player.currentSocket !== undefined) {
                writeTo(player.currentSocket, message, () => {
                    count++;
                    if (count === array.length) {
                        next();
                    }
                });
            }
            else {
                count++;
                if (count === array.length) {
                    next();
                }
            }
        });
    }
}

export = PlayerCommunicator;