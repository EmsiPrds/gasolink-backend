"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnection = redisConnection;
const env_1 = require("../config/env");
function redisConnection() {
    const url = new URL(env_1.env.REDIS_URL ?? "redis://127.0.0.1:6379");
    return {
        host: url.hostname,
        port: url.port ? Number(url.port) : 6379,
        password: url.password || undefined,
        // BullMQ/ioredis expects db as number
        db: url.pathname && url.pathname !== "/" ? Number(url.pathname.replace("/", "")) : undefined,
        maxRetriesPerRequest: null,
    };
}
