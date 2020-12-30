class StandardLibraryProxy {
    
    public randomInt(max: number): number {
        return Math.floor(Math.random() * max);
    }

    public setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timer {
        return setTimeout(callback, ms, args);
    }
    
    public getTime(): number {
        return new Date().getTime();
    }

    public getCurrentDate(): Date {
        return new Date();
    }
}

export = StandardLibraryProxy;