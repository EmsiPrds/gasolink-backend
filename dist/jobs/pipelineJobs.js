"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPipelineJobs = startPipelineJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const env_1 = require("../config/env");
const queues_1 = require("../queue/queues");
function startPipelineJobs() {
    // Scheduled ingest cadence defaults to every 2 hours.
    const aiIngestion = env_1.env.SCHEDULE_AI_INGESTION ?? "0 */2 * * *";
    node_cron_1.default.schedule(aiIngestion, async () => {
        await queues_1.collectorsQueue.add("pipeline-run", {}, { jobId: `pipeline_${Date.now()}` });
    });
    // Lightweight guardrails still run more frequently.
    const quality = env_1.env.SCHEDULE_DATA_QUALITY ?? "*/20 * * * *";
    node_cron_1.default.schedule(quality, async () => {
        await queues_1.qualityQueue.add("quality", {}, { jobId: `quality_${Date.now()}` });
    });
    const aiEstimation = env_1.env.SCHEDULE_AI_ESTIMATION ?? "30 */2 * * *";
    node_cron_1.default.schedule(aiEstimation, async () => {
        await queues_1.aiEstimationQueue.add("ai-estimation", {}, { jobId: `fuse_${Date.now()}` });
    });
}
