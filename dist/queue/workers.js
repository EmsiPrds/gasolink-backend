"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWorkers = startWorkers;
const bullmq_1 = require("bullmq");
const redis_1 = require("./redis");
const accuracyCollectionJob_1 = require("../jobs/accuracyCollectionJob");
const reconcileFuelRecords_1 = require("../reconciliation/reconcileFuelRecords");
const aiPriceEstimation_1 = require("../reconciliation/aiPriceEstimation");
const dataQualityMonitor_1 = require("../quality/dataQualityMonitor");
const UpdateLog_1 = require("../models/UpdateLog");
const normalizeRawSources_1 = require("../pipeline/normalizeRawSources");
const connection = (0, redis_1.redisConnection)();
function startWorkers() {
    // Collectors worker
    new bullmq_1.Worker("collectors", async () => {
        try {
            const collection = await (0, accuracyCollectionJob_1.runAccuracyFirstCollection)();
            const reconcileResult = await (0, reconcileFuelRecords_1.reconcileFuelRecords)();
            await UpdateLog_1.UpdateLog.create({
                module: "collectors",
                status: "success",
                message: `Collectors finished. officialCreated=${collection.officialCollection.created} officialSkipped=${collection.officialCollection.skippedUnchanged} normalized=${collection.normalization.normalized} failed=${collection.normalization.failed} reconciled=${reconcileResult.upserted} aiFallback=${collection.aiFallback.ran ? "yes" : "no"}`,
                timestamp: new Date(),
            }).catch(() => { });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await UpdateLog_1.UpdateLog.create({
                module: "collectors",
                status: "failure",
                message: `Collectors failed: ${message}`,
                timestamp: new Date(),
            }).catch(() => { });
            throw error;
        }
    }, { connection });
    // Reconciliation worker
    new bullmq_1.Worker("reconcile", async () => {
        await (0, normalizeRawSources_1.drainPendingRawSources)({ limitPerPass: 150, maxPasses: 6 });
        await (0, reconcileFuelRecords_1.reconcileFuelRecords)();
    }, { connection });
    // Data quality worker
    new bullmq_1.Worker("quality", async () => {
        await (0, dataQualityMonitor_1.runDataQualityMonitor)();
    }, { connection });
    // AI Estimation worker
    new bullmq_1.Worker("ai-estimation", async () => {
        await (0, aiPriceEstimation_1.runAiPriceEstimation)();
    }, { connection });
    UpdateLog_1.UpdateLog.create({
        module: "workers",
        status: "success",
        message: "Workers started (collectors, reconcile, quality, ai-estimation).",
        timestamp: new Date(),
    }).catch(() => { });
}
