import mongoose = require('mongoose');
import Q = require('q');

import I = require('./Interfaces');
import settings = require('./config/settings');

let logger = require('./logger');

class MongoDbConnectionManager {
	private mongooseConnection: mongoose.Connection;
	private connectedPromise: Q.Promise<void>;

	private buildMongoConnectionString(): string {
		let connectionString: string = "mongodb://";
		if (settings.mongoDbUsername && settings.mongoDbPassword) {
			connectionString += settings.mongoDbUsername + ":" + settings.mongoDbPassword + "@";
		}

		connectionString += settings.mongoDbUris[0];
		for (let i: number = 1; i < settings.mongoDbUris.length; i++) {
			connectionString += "," + settings.mongoDbUris[i];
		}
		connectionString += "/" + settings.mongoDbName;

		if (settings.mongoDbReplicaSet) {
			connectionString += "?" + settings.mongoDbReplicaSet;
		}

		logger.info("MongoDb connection string is " + connectionString);

		return connectionString;
	}


	public connect(): Q.Promise<any> {
		let deferred: Q.Deferred<void> = Q.defer<void>();

		let mongooseConnectionsOptions: mongoose.ConnectionOptions = {
			user: settings.mongoDbUsername,
			pass: settings.mongoDbPassword,
			server: {
				auto_reconnect: true,
				reconnectInterval: settings.mongoDbReconnectIntervalMillis,
				reconnectTries: settings.mongoDbReconnectTries,
				socketOptions: {
					keepAlive: settings.mongoDbKeepAlive
				},
			}
		};

		let connectionString: string = this.buildMongoConnectionString();
		this.mongooseConnection = mongoose.createConnection(connectionString, mongooseConnectionsOptions)

		this.mongooseConnection.on('error', (err: any) => {
			logger.error('Mongoose error while connecting/connected', { error: err, errorMsg: err.message, connectionString: connectionString });
			deferred.reject(err);
		});
		this.mongooseConnection.once('open', function () {
			logger.info("Mongoose opened", { connectionString: connectionString });
			deferred.resolve();
		});
		this.mongooseConnection.on('disconnected', function () {
			logger.error('Mongoose disconnected', { connectionString: connectionString });
		});
		this.mongooseConnection.on('reconnected', function () {
			logger.info('Mongoose reconnected', { connectionString: connectionString });
		});

		return deferred.promise;
	}

	public model<T extends mongoose.Document>(name: string, schema?: mongoose.Schema, collection?: string): mongoose.Model<T> {
		return this.mongooseConnection.model<T>(name, schema, collection);
	}
}

export = MongoDbConnectionManager;