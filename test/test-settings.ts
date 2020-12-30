import Q = require('q');
import should = require('should');
require('should');
import sinon = require('sinon');
import I = require('../Interfaces');
import settings = require('../config/settings');
describe.skip("settings test getting is undefined if not set:", function () {
    //it.skip("write", () => {
    //    settings.publicPorts = [5, 2, 4];
    //    return settings.save();
    //});
    it("get", () => {
        should(settings.redis_password).equal(undefined);
    });
});