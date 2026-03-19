"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWorkers = startWorkers;
const bullmq_1 = require("bullmq");
const redis_1 = require("./redis");
const runCollectors_1 = require("../scrapers/runCollectors");
const reconcileFuelRecords_1 = require("../reconciliation/reconcileFuelRecords");
const dataQualityMonitor_1 = require("../quality/dataQualityMonitor");
const UpdateLog_1 = require("../models/UpdateLog");
const normalizeRawSources_1 = require("../pipeline/normalizeRawSources");
const connection = (0, redis_1.redisConnection)();
function startWorkers() {
    // Collectors worker
    new bullmq_1.Worker("collectors", async () => {
        await (0, runCollectors_1.runAllCollectors)();
        await (0, normalizeRawSources_1.normalizePendingRawSources)({ limit: 100 });
    }, { connection });
    // Reconciliation worker
    new bullmq_1.Worker("reconcile", async () => {
        await (0, normalizeRawSources_1.normalizePendingRawSources)({ limit: 200 });
        await (0, reconcileFuelRecords_1.reconcileFuelRecords)();
    }, { connection });
    // Data quality worker
    new bullmq_1.Worker("quality", async () => {
        await (0, dataQualityMonitor_1.runDataQualityMonitor)();
    }, { connection });
    UpdateLog_1.UpdateLog.create({
        module: "workers",
        status: "success",
        message: "Workers started (collectors, reconcile, quality).",
        timestamp: new Date(),
    }).catch(() => { });
}
