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
    const official = env_1.env.SCHEDULE_PH_OFFICIAL ?? "15 */1 * * *"; // every hour at minute 15
    const company = env_1.env.SCHEDULE_PH_COMPANY ?? "*/30 * * * *"; // every 30 minutes
    const observed = env_1.env.SCHEDULE_PH_OBSERVED ?? "45 */1 * * *"; // every hour at minute 45
    const reconcile = env_1.env.SCHEDULE_RECONCILE ?? "*/10 * * * *"; // every 10 minutes
    const quality = env_1.env.SCHEDULE_DATA_QUALITY ?? "*/15 * * * *"; // every 15 minutes
    // For now all collectors run together; sources registry decides which ones exist.
    node_cron_1.default.schedule(official, async () => {
        await queues_1.collectorsQueue.add("official_collect", {}, { jobId: `official_${Date.now()}` });
    });
    node_cron_1.default.schedule(company, async () => {
        await queues_1.collectorsQueue.add("company_collect", {}, { jobId: `company_${Date.now()}` });
    });
    node_cron_1.default.schedule(observed, async () => {
        await queues_1.collectorsQueue.add("observed_collect", {}, { jobId: `observed_${Date.now()}` });
    });
    node_cron_1.default.schedule(reconcile, async () => {
        await queues_1.reconcileQueue.add("reconcile", {}, { jobId: `reconcile_${Date.now()}` });
    });
    node_cron_1.default.schedule(quality, async () => {
        await queues_1.qualityQueue.add("quality", {}, { jobId: `quality_${Date.now()}` });
    });
}
