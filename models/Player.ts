import net = require('net');

class Player {
    //public static loggedInPlayers: { [uniqueName: string]: Player; } = {};
    //public static getOrCreatePlayer(playerNameInput: string) {
    //    let player: Player;
    //    player = Player.loggedInPlayers[playerNameInput.toUpperCase()]
    //    if (player) return player;
    //
    //    player = new Player(playerNameInput);
    //    Player.loggedInPlayers[player.uniqueName] = player;
    //    return player;
    //}
    //public static removeAndRemakePlayer(playerNameInput: string) {
    //    if (Player.loggedInPlayers[playerNameInput.toUpperCase()]) {
    //        if (Player.loggedInPlayers[playerNameInput.toUpperCase()].currentSocket) delete Player.loggedInPlayers[playerNameInput.toUpperCase()].currentSocket;
    //        delete Player.loggedInPlayers[playerNameInput.toUpperCase()];
    //    }
    //    return Player.getOrCreatePlayer(playerNameInput);
    //}

    private playerName: string; //Assumed to be unique
    public getName(): string {
        return this.playerName;
    }
    constructor(name: string) {
        this.playerName = name;
        this.uniqueName = Player.getUniqueNameFromPlayerName(name);
    }
    public uniqueName: string;

    public currentSocket: net.Socket;
    public connectionKey: string = 'foobar';
    public static getUniqueNameFromPlayerName(name: string): string  {
        return name.toUpperCase();
    }
    public static assertCorrectConnectionKeyAndGetUniqueName(playername:string, key: string): string {
        //We are not doing any checking here yet. For now we just trust users. Later if we run into isseus we can push user request connection keys from accounts then we check them via redis
        //If there is an issue throw
        return playername.toUpperCase();
    }
}
export = Player;