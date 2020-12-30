import Q = require('q');
import redis = require('redis');
import I = require('../Interfaces');

class Platform {
    public static db: redis.RedisClient;
    private static _motd: string = "Thanks for playing!";
    private static _featureToggles: { [s: string]: boolean; } = {};
    private static updateTimeout = false;

    public static get motd(): string {
        this.updateIfNotScheduled();
        return Platform._motd;
    }
    public static get featureToggles(): { [s: string]: boolean; } {
        this.updateIfNotScheduled();
        return Platform._featureToggles;
    }

    public static init() {
        Platform.update();
    }

    private static update() {
        this.updateMOTD();
        this.updateFeatureToggles();
    }

    private static updateIfNotScheduled() {
        if (!this.updateTimeout) {
            this.update();
            this.updateTimeout = true;
            setTimeout(() => { this.updateTimeout = false; }, 20 * 1000); // will update every 20s at max
        }
    }

    private static updateMOTD() {
        Platform.db.get('platform:motd', (err, result) => {
            if (err) return;
            if (result) this._motd = result;
        });
    }
    private static updateFeatureToggles() {
        Platform.db.get('platform:featureToggles', (err, result) => {
            if (err) return;
            if (result) {
                let parsed: any = JSON.parse(result);
                if (parsed) {
                    this._featureToggles = parsed;
                }
            }
        });
    }
}

export = Platform;