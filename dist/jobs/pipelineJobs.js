"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPipelineJobs = startPipelineJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const env_1 = require("../config/env");
const queues_1 = require("../queue/queues");
const UpdateLog_1 = require("../models/UpdateLog");
function startPipelineJobs() {
    // DOE ingest is now manual-admin driven. Keep a startup log so operators know why no cron is running.
    UpdateLog_1.UpdateLog.create({
        module: "pipeline_jobs",
        status: "success",
        message: "DOE collection cron disabled. Use Admin DOE upload flow for ingestion.",
        timestamp: new Date(),
    }).catch(() => { });
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
