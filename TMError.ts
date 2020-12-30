class TMError extends Error {
    public isPlayerFacing: boolean;
    public error: Error;

    constructor(playerFacing: boolean, message: string, error?: Error) {
        super(message);
        this.isPlayerFacing = playerFacing;
    }
}

export = TMError;