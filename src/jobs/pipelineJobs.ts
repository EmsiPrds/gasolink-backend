import cron from "node-cron";
import { env } from "../config/env";
import { collectorsQueue, qualityQueue, reconcileQueue, aiEstimationQueue } from "../queue/queues";
import { runAiSearchDataGathering } from "./aiSearchJob";

export function startPipelineJobs() {
  // Weekly on Mondays at 4:00 PM (16:00) - Philippine fuel price adjustments are typically announced then.
  const aiSearchSchedule = env.SCHEDULE_PH_OFFICIAL ?? "0 16 * * 1";
  const reconcile = env.SCHEDULE_RECONCILE ?? "*/10 * * * *"; // every 10 minutes
  const quality = env.SCHEDULE_DATA_QUALITY ?? "*/15 * * * *"; // every 15 minutes
  const aiEstimation = env.SCHEDULE_AI_ESTIMATION ?? "0 */2 * * *"; // every 2 hours at minute 0

  // The primary data gathering is now AI-driven search.
  // Traditional scrapers/collectors are disabled to simplify the process.
  cron.schedule(aiSearchSchedule, async () => {
    console.log("Triggering scheduled AI search data gathering...");
    await runAiSearchDataGathering();
  });

  cron.schedule(reconcile, async () => {
    await reconcileQueue.add("reconcile", {}, { jobId: `reconcile_${Date.now()}` });
  });

  cron.schedule(quality, async () => {
    await qualityQueue.add("quality", {}, { jobId: `quality_${Date.now()}` });
  });

  cron.schedule(aiEstimation, async () => {
    await aiEstimationQueue.add("ai-estimation", {}, { jobId: `ai_est_${Date.now()}` });
  });
}

