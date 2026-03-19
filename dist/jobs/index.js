"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startJobs = startJobs;
const dailySnapshotJob_1 = require("./dailySnapshotJob");
const globalPriceJob_1 = require("./globalPriceJob");
const pipelineJobs_1 = require("./pipelineJobs");
const workers_1 = require("../queue/workers");
function startJobs() {
    // Start queue workers first so cron enqueued jobs can be processed.
    (0, workers_1.startWorkers)();
    (0, globalPriceJob_1.startGlobalPriceJob)();
    (0, dailySnapshotJob_1.startDailySnapshotJob)();
    (0, pipelineJobs_1.startPipelineJobs)();
}
