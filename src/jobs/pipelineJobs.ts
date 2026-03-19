import cron from "node-cron";
import { env } from "../config/env";
import { collectorsQueue, qualityQueue, reconcileQueue } from "../queue/queues";

export function startPipelineJobs() {
  const official = env.SCHEDULE_PH_OFFICIAL ?? "15 */1 * * *"; // every hour at minute 15
  const company = env.SCHEDULE_PH_COMPANY ?? "*/30 * * * *"; // every 30 minutes
  const observed = env.SCHEDULE_PH_OBSERVED ?? "45 */1 * * *"; // every hour at minute 45
  const reconcile = env.SCHEDULE_RECONCILE ?? "*/10 * * * *"; // every 10 minutes
  const quality = env.SCHEDULE_DATA_QUALITY ?? "*/15 * * * *"; // every 15 minutes

  // For now all collectors run together; sources registry decides which ones exist.
  cron.schedule(official, async () => {
    await collectorsQueue.add("official_collect", {}, { jobId: `official_${Date.now()}` });
  });

  cron.schedule(company, async () => {
    await collectorsQueue.add("company_collect", {}, { jobId: `company_${Date.now()}` });
  });

  cron.schedule(observed, async () => {
    await collectorsQueue.add("observed_collect", {}, { jobId: `observed_${Date.now()}` });
  });

  cron.schedule(reconcile, async () => {
    await reconcileQueue.add("reconcile", {}, { jobId: `reconcile_${Date.now()}` });
  });

  cron.schedule(quality, async () => {
    await qualityQueue.add("quality", {}, { jobId: `quality_${Date.now()}` });
  });
}

