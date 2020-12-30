import mongoose = require('mongoose');
import I = require('./Interfaces');
import logger = require('./logger');

class MongoDbCollectionClient<T extends mongoose.Document> {
    private Model: mongoose.Model<T>;
    private readonly standardLibraryProxy: I.StandardLibraryProxy;

    constructor(model: mongoose.Model<T>, standardLibraryProxy: I.StandardLibraryProxy) {
        this.Model = model;
        this.standardLibraryProxy = standardLibraryProxy;
    }

    public find(conditions: Object, callback?: (err: any, res: T[]) => void): mongoose.DocumentQuery<T[], T> {
        const startTime: number = this.standardLibraryProxy.getCurrentDate().getTime();
        return this.Model.find(conditions, (err: any, res: T[]): void => {
            const durationMs: number = this.standardLibraryProxy.getCurrentDate().getTime() - startTime;
            logger.info("MongoClient", { queryType: "find", conditions: JSON.stringify(conditions), durationMs: durationMs });
            callback(err, res);
        });
    }

    public findOne(conditions?: Object, callback?: (err: any, res: T) => void): mongoose.DocumentQuery<T, T> {
        const startTime: number = this.standardLibraryProxy.getCurrentDate().getTime();
        return this.Model.findOne(conditions, (err: any, res: T): void => {
            const durationMs: number = this.standardLibraryProxy.getCurrentDate().getTime() - startTime;
            logger.info("MongoClient", { queryType: "findOne", conditions: JSON.stringify(conditions), durationMs: durationMs });
            callback(err, res);
        });
    }

    public save(document:T, options?: mongoose.SaveOptions, fn?: (err: any, product: T, numAffected: number) => void): Promise<T> {
        const startTimeMs: number = this.standardLibraryProxy.getCurrentDate().getTime();
        return document.save(options, (err: any, product: T, numAffected: number): void => {
            const durationMs: number = this.standardLibraryProxy.getCurrentDate().getTime() - startTimeMs;
            logger.info("MongoClient", { durationMs: durationMs, queryType: "save" });
            fn(err, product, numAffected);
        });
    }

    public findOneAndUpdate(conditions: Object, update: Object, options: mongoose.ModelFindOneAndUpdateOptions, callback?: (err: any, res: T) => void): mongoose.DocumentQuery<T, T> {
        const startTimeMs: number = this.standardLibraryProxy.getCurrentDate().getTime();
        return this.Model.findOneAndUpdate(conditions, update, options, (err:any, res: T): void => {
            const durationMs: number = this.standardLibraryProxy.getCurrentDate().getTime() - startTimeMs;
            logger.info("MongoClient", { durationMs: durationMs, queryType: "findOneAndUpdate" });
            callback(err, res);
        });
    }

    public findOneAndRemove(conditions: Object, callback?: (err: any, res: T) => void): mongoose.DocumentQuery<T, T> {
        const startTimeMs: number = this.standardLibraryProxy.getCurrentDate().getTime();
        return this.Model.findOneAndRemove(conditions, (err: any, res: T): void => {
            const durationMs: number = this.standardLibraryProxy.getCurrentDate().getTime() - startTimeMs;
            logger.info("MongoClient", { durationMs: durationMs, queryType: "findOneAndRemove" });
            callback(err, res);
        });
    }

    public count(conditions: Object, callback?: (err: any, count: number) => void): mongoose.Query<number> {
        const startTimeMs: number = this.standardLibraryProxy.getCurrentDate().getTime();
        return this.Model.count(conditions, (err: any, count: number): void => {
            const durationMs: number = this.standardLibraryProxy.getCurrentDate().getTime() - startTimeMs;
            logger.info("MongoClient", { durationMs: durationMs, queryType: "count" });
            callback(err, count);
        });
    }

    // this doesn't call out to db at all, so it doesn't durationMs logging
    public createNew(sourceObject:any): T {
        return new this.Model(sourceObject);
    }
}

export = MongoDbCollectionClient;