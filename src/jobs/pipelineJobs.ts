import cron from "node-cron";
import { env } from "../config/env";
import { collectorsQueue, qualityQueue, reconcileQueue, aiEstimationQueue } from "../queue/queues";

export function startPipelineJobs() {
  // Poll official sources several times a day so new DOE postings are picked up quickly.
  const officialCollectionSchedule = env.SCHEDULE_PH_OFFICIAL ?? "0 */4 * * *";
  const reconcile = env.SCHEDULE_RECONCILE ?? "*/10 * * * *"; // every 10 minutes
  const quality = env.SCHEDULE_DATA_QUALITY ?? "*/15 * * * *"; // every 15 minutes
  const aiEstimation = env.SCHEDULE_AI_ESTIMATION ?? "0 */2 * * *"; // every 2 hours at minute 0

  // The primary data gathering is official-source collection with AI only as a fallback support path.
  cron.schedule(officialCollectionSchedule, async () => {
    console.log("Queueing scheduled official-source collection...");
    await collectorsQueue.add("collect", {}, { jobId: `collect_${Date.now()}` });
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
