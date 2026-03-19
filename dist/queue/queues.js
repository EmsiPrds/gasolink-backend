"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qualityQueue = exports.reconcileQueue = exports.collectorsQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("./redis");
const connection = (0, redis_1.redisConnection)();
exports.collectorsQueue = new bullmq_1.Queue("collectors", { connection });
exports.reconcileQueue = new bullmq_1.Queue("reconcile", { connection });
exports.qualityQueue = new bullmq_1.Queue("quality", { connection });
