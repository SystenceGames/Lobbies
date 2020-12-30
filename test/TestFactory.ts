import I = require('../Interfaces');

class TestFactory {
    public static fakePort: number = 12345;
    public static fakeHost: string = "example.com";
    public static fakeGameGUID: string = "gameGuid";
    public static sessionToken: string = "sessionToken";
    public static httpEndpoint: string = "http://127.0.0.1:10200";
    
    public static playerUniqueName(i: number): string {
        return "PLAYERNAME" + (i + 1);
    }

    public static steamId(i: number): number {
        return i + 1;
    }
}

export = TestFactory;