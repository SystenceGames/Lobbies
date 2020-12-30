import Q = require('q');
import I = require('./Interfaces');
import settings = require('./config/settings');
import logger = require('./logger');

class PlatformStatusService {
	private platformStatusDb: I.PlatformStatusDb;
    private motd: string = "Thanks for playing!";
    private featureToggles: any;

	constructor(platformStatusDb: I.PlatformStatusDb) {
		this.platformStatusDb = platformStatusDb;
	}

    public updatePlatformStatus(): Q.Promise<any> {
		return this.platformStatusDb.getPlatformStatus().then((platformStatus: I.PlatformStatus) => {
            if (platformStatus == null) {
                logger.error("Error retrieving platform status from mongodb");
                return;
            }
			this.motd = platformStatus.motd;

			try {
				let parsedResponse = JSON.parse(platformStatus.featureTogglesString);

				if (parsedResponse == null || parsedResponse == undefined) {
					logger.error("Error parsing feature toggles retrieved from mongodb - parsed value was null");
					return;
                }

                this.featureToggles = parsedResponse;
			} catch (error) {
				logger.error("Error parsing feature toggles retrieved from mongodb", error);
				return;
			}
        });
    }

	public init(): Q.Promise<void> {
		setInterval(() => {
			this.updatePlatformStatus().done();
		}, settings.platformStatusUpdateFrequencyMillis);
		return this.updatePlatformStatus();
    }

    public platformMOTD(): Q.Promise<I.PlatformMOTDResponse> {
        return Q.fcall(() => {
            let platformMOTDResponse: I.PlatformMOTDResponse = {
                MOTD: this.motd,
                featureToggles: this.featureToggles
            };

            return platformMOTDResponse;
        });
    }

}

export = PlatformStatusService;