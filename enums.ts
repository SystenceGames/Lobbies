export enum LobbyInfoState {
    TeamSelect,
    CommanderSelect,
    GameStarting,
    InGame,
    GameEnded,
    GameCanceled
}

export enum BotDifficulty {
    None,
    Beginner,
    Intermediate
}

export enum CommanderSelectStatus {
    Unselected,
    Selected,
    Locked
}

export enum ProcessState {
    StartingProcess,
    RunningProcess,
    EndedProcess,
    FailedProcess
}

export enum JobState {
    allocating,
    allocated
}
