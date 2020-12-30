import redis = require("redis");
import settings = require('./config/settings');
import logger = require('./logger');

console.log("Connecting to redis at " + settings.redis_address + " port:" + settings.redis_port);
let client = redis.createClient(settings.redis_port, settings.redis_address, {auth_pass: settings.redis_password});

client.on('connect', () => {
    logger.info("Redis connected successfully", { codepath: "db.connect", port: settings.redis_port, address: settings.redis_address });
})
client.on('error', (err: any) => {
    logger.error('redis connection error', { codepath: "db.onError", error: err, errorMsg: err.message });
});
export = client;

