let db = require('./db');
import Q = require('q');
import redis = require("redis");
import I = require('./Interfaces');
import logger = require('./logger');

class RedisClientWrapper implements I.RedisClientWrapper {
    private db: redis.RedisClient;

    constructor(db: redis.RedisClient) {
        this.db = db;
    }

    public multi(args: Array<any>): Q.Promise<any> {
        let multi = this.db.multi(args);
        return Q.ninvoke(multi, 'exec');
    }

    public lrange(key: string, headIndex:number, tailIndex: number): Q.Promise<Array<any>> {
        let deferred: Q.Deferred<Array<any>> = Q.defer<Array<any>>();

        let success: boolean = this.db.lrange(key, headIndex, tailIndex, (err: Error, res: Array<any>): void => {
            if (err) {
                logger.error("Error getting an lrange", err);
                deferred.reject(err);
                return;
            }

            deferred.resolve(res);
        });

        if (success) {
            return deferred.promise;
        } else {
            logger.error("Immediate Erroring running lrange against redis for key: " + key + " headIndex: " + headIndex + " tailIndex: " + tailIndex);
            deferred.reject("Error getting invites");
            return deferred.promise;
        }
    }

    public lrem(key: string, count: number, value: string): Q.Promise<number> {
        let deferred: Q.Deferred<number> = Q.defer<number>();

        let success: boolean = this.db.lrem(key, count, value, (err: Error, res: number): void => {
            if (err) {
                logger.error("Error getting an lrem", err);
                deferred.reject(err);
                return;
            }

            deferred.resolve(res);
        });


        if (success) {
            return deferred.promise;
        } else {
            logger.error("Immediate Erroring running lrem against redis for key: " + key + " count: " + count + " value: " + value);
            deferred.reject("Error deleting invite");
            return deferred.promise;
        }
    }

    public get(key: string, callback: (err: Error, res: string) => void): boolean {
        return this.db.get(key, callback);
    }
}

export = RedisClientWrapper;