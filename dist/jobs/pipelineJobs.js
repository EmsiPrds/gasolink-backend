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
    // Poll official sources several times a day so new DOE postings are picked up quickly.
    const officialCollectionSchedule = env_1.env.SCHEDULE_PH_OFFICIAL ?? "0 */4 * * *";
    const reconcile = env_1.env.SCHEDULE_RECONCILE ?? "*/10 * * * *"; // every 10 minutes
    const quality = env_1.env.SCHEDULE_DATA_QUALITY ?? "*/15 * * * *"; // every 15 minutes
    const aiEstimation = env_1.env.SCHEDULE_AI_ESTIMATION ?? "0 */2 * * *"; // every 2 hours at minute 0
    // The primary data gathering is official-source collection with AI only as a fallback support path.
    node_cron_1.default.schedule(officialCollectionSchedule, async () => {
        console.log("Queueing scheduled official-source collection...");
        await queues_1.collectorsQueue.add("collect", {}, { jobId: `collect_${Date.now()}` });
    });
    node_cron_1.default.schedule(reconcile, async () => {
        await queues_1.reconcileQueue.add("reconcile", {}, { jobId: `reconcile_${Date.now()}` });
    });
    node_cron_1.default.schedule(quality, async () => {
        await queues_1.qualityQueue.add("quality", {}, { jobId: `quality_${Date.now()}` });
    });
    node_cron_1.default.schedule(aiEstimation, async () => {
        await queues_1.aiEstimationQueue.add("ai-estimation", {}, { jobId: `ai_est_${Date.now()}` });
    });
}
