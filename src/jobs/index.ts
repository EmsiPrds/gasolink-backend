import { startDailySnapshotJob } from "./dailySnapshotJob";
import { startGlobalPriceJob } from "./globalPriceJob";
import { startPipelineJobs } from "./pipelineJobs";
import { startWorkers } from "../queue/workers";

export function startJobs() {
  // Start queue workers first so cron enqueued jobs can be processed.
  startWorkers();
  startGlobalPriceJob();
  startDailySnapshotJob();
  startPipelineJobs();
}

