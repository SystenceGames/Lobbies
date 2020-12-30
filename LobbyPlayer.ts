import Player = require('./models/Player');
import Enums = require('./enums');

class LobbyPlayer {
    public player: Player;
    public commanderSelected: string;
    static defaultCommander = 'Random';
    public commanderSelectState: Enums.CommanderSelectStatus;
    public teamNumber: number;
    public host: boolean;
    public isBot: boolean = false;
    public botDifficulty: Enums.BotDifficulty = Enums.BotDifficulty.None;

    constructor(player: Player, teamNumber: number) {
        this.player = player;
        this.commanderSelected = LobbyPlayer.defaultCommander;
        this.commanderSelectState = Enums.CommanderSelectStatus.Unselected
        this.teamNumber = teamNumber;
        this.host = false;
    }

    public selectCommander(commanderName: string) {
        this.commanderSelected = commanderName;
        this.commanderSelectState = Enums.CommanderSelectStatus.Selected;
    }

    public resetCommanderSelection() {
        this.commanderSelectState = Enums.CommanderSelectStatus.Unselected;
    }

    public isHost() {
        return this.host;
    }

    public isCommanderSelected() {
        return this.commanderSelectState == Enums.CommanderSelectStatus.Selected;
    }
    public isCommanderSelectLocked() {
        return this.commanderSelectState == Enums.CommanderSelectStatus.Locked;
    }

    public isSpectator() {
        return 3 === this.teamNumber;
    }

    public lockCommanderSelect() {
        this.commanderSelectState = Enums.CommanderSelectStatus.Locked;
    }

    public setTeam(team: number) {
        this.teamNumber = team;
    }

    public toggleTeam() {
        this.teamNumber = 3 - this.teamNumber;
    }
}

export = LobbyPlayer;