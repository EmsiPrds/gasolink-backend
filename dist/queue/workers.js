"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWorkers = startWorkers;
const bullmq_1 = require("bullmq");
const redis_1 = require("./redis");
const aiPriceEstimation_1 = require("../reconciliation/aiPriceEstimation");
const dataQualityMonitor_1 = require("../quality/dataQualityMonitor");
const UpdateLog_1 = require("../models/UpdateLog");
const normalizeRawSources_1 = require("../pipeline/normalizeRawSources");
const sourceCollectionService_1 = require("../services/sourceCollectionService");
const doeLatestCleanupService_1 = require("../services/doeLatestCleanupService");
const connection = (0, redis_1.redisConnection)();
function startWorkers() {
    // AI ingestion worker (legacy collectors queue retained for compatibility)
    new bullmq_1.Worker("collectors", async () => {
        try {
            const collectionResult = await (0, sourceCollectionService_1.runConfiguredSourceCollection)({ scope: "official" });
            const normalizeResult = await (0, normalizeRawSources_1.drainPendingRawSources)({ limitPerPass: 100, maxPasses: 3 });
            await (0, dataQualityMonitor_1.runDataQualityMonitor)();
            const estimationResult = await (0, aiPriceEstimation_1.runAiPriceEstimation)();
            const cleanup = await (0, doeLatestCleanupService_1.cleanupOutdatedDoeData)();
            await UpdateLog_1.UpdateLog.create({
                module: "pipeline_run",
                status: "success",
                message: `DOE-only pipeline finished. collected=${collectionResult.created}/${collectionResult.attempted} rawFailed=${collectionResult.failed} normalized=${normalizeResult.normalized} normalizeFailed=${normalizeResult.failed} estimates=${estimationResult.estimations} cleanupNormalized=${cleanup.deletedNormalized} cleanupPublished=${cleanup.deletedPublished}`,
                timestamp: new Date(),
            }).catch(() => { });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await UpdateLog_1.UpdateLog.create({
                module: "pipeline_run",
                status: "failure",
                message: `Pipeline failed: ${message}`,
                timestamp: new Date(),
            }).catch(() => { });
            throw error;
        }
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
        message: "Workers started (pipeline-run, quality, ai-estimation).",
        timestamp: new Date(),
    }).catch(() => { });
}
