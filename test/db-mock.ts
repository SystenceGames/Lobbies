import redisType = require("redis");
let redis = require("fakeredis");

console.log("starting mock DB");
let client: redisType.RedisClient = redis.createClient(6379, '127.0.0.1', null);

export = client;