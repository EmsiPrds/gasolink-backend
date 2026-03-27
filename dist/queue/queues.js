"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiEstimationQueue = exports.qualityQueue = exports.collectorsQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("./redis");
const connection = (0, redis_1.redisConnection)();
exports.collectorsQueue = new bullmq_1.Queue("collectors", { connection });
exports.qualityQueue = new bullmq_1.Queue("quality", { connection });
exports.aiEstimationQueue = new bullmq_1.Queue("ai-estimation", { connection });
