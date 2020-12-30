import Q = require('q');
import mongoose = require('mongoose');

import I = require('./Interfaces');
import settings = require('./config/settings');

let logger = require('./logger');
import MongoDbConnectionManager = require('./MongoDbConnectionManager');
import MongoDbCollectionClient = require('./MongoDbCollectionClient');

interface IMongoDbPlatformStatus extends mongoose.Document {
	motd: string;
	featureTogglesString: string;
}

class PlatformStatusDb implements I.PlatformStatusDb {
	private static PLATFORM_STATUS_COLLECTION_NAME: string = 'platformstatus';
	private static PLATFORM_STATUS_MODEL_NAME: string = 'PlatformStatus';
	private static FIND_AND_UPDATE_OPTIONS: mongoose.ModelFindOneAndUpdateOptions = { new: true };

    private readonly mongoDbConnectionManager: MongoDbConnectionManager;
    private readonly standardLibraryProxy: I.StandardLibraryProxy;
    private mongoDbCollectionClient: MongoDbCollectionClient<IMongoDbPlatformStatus>;

	private platformStatusSchema = new mongoose.Schema({
		motd: { type: String },
		featureTogglesString: { type: String }
	});

	constructor(mongoDbConnectionManager: MongoDbConnectionManager, standardLibraryProxy: I.StandardLibraryProxy) {
		this.mongoDbConnectionManager = mongoDbConnectionManager;
        this.standardLibraryProxy = standardLibraryProxy;
	}

	public init(): void {
        let rawPlatformStatusModel: mongoose.Model<IMongoDbPlatformStatus> = this.mongoDbConnectionManager.model<IMongoDbPlatformStatus>(PlatformStatusDb.PLATFORM_STATUS_MODEL_NAME, this.platformStatusSchema, PlatformStatusDb.PLATFORM_STATUS_COLLECTION_NAME);
        this.mongoDbCollectionClient = new MongoDbCollectionClient(rawPlatformStatusModel, this.standardLibraryProxy);
	}

	public createNewPlatformStatus(motd: string, featureTogglesString: string): Q.Promise<I.PlatformStatus> {
		let deferred = Q.defer<any>();

        let newPlatformStatus = this.mongoDbCollectionClient.createNew({
			motd: motd,
			featureTogglesString: featureTogglesString
		});

		newPlatformStatus.save((err: any, mongoDbPlatformStatus: any) => {
			if (err) {
				return deferred.reject(err);
			}

			return deferred.resolve({
				motd: mongoDbPlatformStatus.motd,
				featureTogglesString: mongoDbPlatformStatus.featureTogglesString
			});
		});

		return deferred.promise;
	}

	public getPlatformStatus(): Q.Promise<I.PlatformStatus> {
		let deferred = Q.defer<any>();
		this.mongoDbCollectionClient.findOne(
			{},
			(err: any, mongoDbPlatformStatus: any) => {
				if (err) {
					logger.error(err);
					return deferred.reject(err);
				}
				if (mongoDbPlatformStatus == null) {
					logger.warn("mongoDbPlatformStatus is null");
					return deferred.resolve(null);
				}

				return deferred.resolve({
					motd: mongoDbPlatformStatus.motd,
					featureTogglesString: mongoDbPlatformStatus.featureTogglesString
				});
			});

		return deferred.promise;
	}

	public setMotd(motd: string): Q.Promise<void> {
		let deferred = Q.defer<any>();

		this.mongoDbCollectionClient.findOneAndUpdate(
			{},
			{
				$set: { "motd": motd }
			},
			PlatformStatusDb.FIND_AND_UPDATE_OPTIONS,
            (err: any, mongoDbPlatformStatus: any) => {
				if (err) {
					logger.error(err);
					return deferred.reject(err);
				}

				return deferred.resolve(null);
			});

		return deferred.promise;
	}

	public setFeatureTogglesString(featureTogglesString: string): Q.Promise<void> {
		let deferred = Q.defer<any>();

		this.mongoDbCollectionClient.findOneAndUpdate(
			{},
			{
				$set: { "featureTogglesString": featureTogglesString }
			},
			PlatformStatusDb.FIND_AND_UPDATE_OPTIONS,
            (err: any, mongoDbPlatformStatus: any) => {
				if (err) {
					logger.error(err);
					return deferred.reject(err);
				}

				return deferred.resolve(null);
			});

		return deferred.promise;
	}
}

export = PlatformStatusDb;