import assert = require('assert');
import PlatformStatusService = require('../PlatformStatusService');
import I = require('../Interfaces');
import should = require('should');
require('should');
import sinon = require('sinon');
import Q = require('q');

describe("PlatformStatusService", () => {
	let platformStatusService: PlatformStatusService;
	let mockPlatformStatusDb: I.PlatformStatusDb;
    let sandbox: sinon.SinonSandbox;
	let motd: string = "catdog";
	let getPlatformStatusStub: sinon.SinonStub;
	let setFeatureTogglesStringStub: sinon.SinonStub;
	let setMotdStub: sinon.SinonStub;
    
    beforeEach(() => {
        sandbox = sinon.sandbox.create();
		let stubbedFeatureToggles: any = {
			isOnline: true,
			multiplayerEnabled: true
		};
		let stubbedPlatformStatus: I.PlatformStatus = {
			motd: motd,
			featureTogglesString: JSON.stringify(stubbedFeatureToggles)
		};

		getPlatformStatusStub = sandbox.stub();
		getPlatformStatusStub.returns(Q.fcall(() => { return stubbedPlatformStatus; }));

		mockPlatformStatusDb = {
			createNewPlatformStatus: sandbox.stub(),
			getPlatformStatus: getPlatformStatusStub,
			init: sandbox.stub(),
			setFeatureTogglesString: setFeatureTogglesStringStub,
			setMotd: setMotdStub
        };
		platformStatusService = new PlatformStatusService(mockPlatformStatusDb);

		return platformStatusService.updatePlatformStatus();
    });

    it("returns PlatformMOTDResponse", () => {
        let expectedFeatureToggles: any = {
            isOnline: true,
            multiplayerEnabled: true
        };
        let expectedPlatformMOTDResponse: I.PlatformMOTDResponse = {
            MOTD: motd,
            featureToggles: expectedFeatureToggles
		};
		return platformStatusService.platformMOTD().then((platformMOTDResponse: I.PlatformMOTDResponse) => {
            should.deepEqual(platformMOTDResponse, expectedPlatformMOTDResponse);
        });
    });

    it("PlatformMOTDResponse featureToggles remains same after updating with broken json", () => {
        let expectedFeatureToggles: any = {
            isOnline: true,
            multiplayerEnabled: true
        };
        let expectedPlatformMOTDResponse: I.PlatformMOTDResponse = {
            MOTD: motd,
            featureToggles: expectedFeatureToggles
		};

		let stubbedPlatformMOTDResponse: I.PlatformStatus = {
			motd: motd,
			featureTogglesString: "{"
		};

		getPlatformStatusStub.returns(Q.fcall(() => { return stubbedPlatformMOTDResponse; }));

        return platformStatusService.updatePlatformStatus().then(() => {
            return platformStatusService.platformMOTD();
        }).then((platformMOTDResponse: I.PlatformMOTDResponse) => {
            should.deepEqual(platformMOTDResponse, expectedPlatformMOTDResponse);
        });
    });

    it("PlatformMOTDResponse featureToggles remains same after updating with null value", () => {
        let expectedFeatureToggles: any = {
            isOnline: true,
            multiplayerEnabled: true
        };
        let expectedPlatformMOTDResponse: I.PlatformMOTDResponse = {
            MOTD: motd,
            featureToggles: expectedFeatureToggles
        };
		getPlatformStatusStub.returns(Q.fcall(() => { return null; }));

        return platformStatusService.updatePlatformStatus().then(() => {
            return platformStatusService.platformMOTD();
        }).then((platformMOTDResponse: I.PlatformMOTDResponse) => {
            should.deepEqual(platformMOTDResponse, expectedPlatformMOTDResponse);
        });
    });

    it("PlatformMOTDResponse featureToggles changes when multiplayerEnabled set from true to false", () => {
        let expectedFeatureToggles: any = {
            isOnline: true,
            multiplayerEnabled: false
        };
        let expectedPlatformMOTDResponse: I.PlatformMOTDResponse = {
            MOTD: motd,
            featureToggles: expectedFeatureToggles
		};

		let stubbedFeatureToggles: any = {
			isOnline: true,
			multiplayerEnabled: false
		};
		let stubbedPlatformMOTDResponse: I.PlatformStatus = {
			motd: motd,
			featureTogglesString: JSON.stringify(stubbedFeatureToggles)
		};

		getPlatformStatusStub.returns(Q.fcall(() => { return stubbedPlatformMOTDResponse; }));

        return platformStatusService.updatePlatformStatus().then(() => {
            return platformStatusService.platformMOTD();
        }).then((platformMOTDResponse: I.PlatformMOTDResponse) => {
            should.deepEqual(platformMOTDResponse, expectedPlatformMOTDResponse);
        });
    });

    it("PlatformMOTDResponse featureToggles changes when isOnline set from true to false", () => {
        let expectedFeatureToggles: any = {
            isOnline: false,
            multiplayerEnabled: true
        };
        let expectedPlatformMOTDResponse: I.PlatformMOTDResponse = {
            MOTD: motd,
            featureToggles: expectedFeatureToggles
        };

		let stubbedFeatureToggles: any = {
			isOnline: false,
			multiplayerEnabled: true
		};
		let stubbedPlatformMOTDResponse: I.PlatformStatus = {
			motd: motd,
			featureTogglesString: JSON.stringify(stubbedFeatureToggles)
		};

		getPlatformStatusStub.returns(Q.fcall(() => { return stubbedPlatformMOTDResponse; }));

        return platformStatusService.updatePlatformStatus().then(() => {
            getPlatformStatusStub.withArgs("platform:featureToggles").callsArgWith(1, null, "{\"isOnline\":false,\"multiplayerEnabled\":true}").returns(true);
            return platformStatusService.updatePlatformStatus();
        }).then(() => {
            return platformStatusService.platformMOTD();
        }).then((platformMOTDResponse: I.PlatformMOTDResponse) => {
            should.deepEqual(platformMOTDResponse, expectedPlatformMOTDResponse);
        });
    });
});
