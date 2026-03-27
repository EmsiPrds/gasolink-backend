import cron from "node-cron";
import { env } from "../config/env";
import { collectorsQueue, qualityQueue, aiEstimationQueue } from "../queue/queues";

export function startPipelineJobs() {
  // Scheduled ingest cadence defaults to every 2 hours.
  const aiIngestion = env.SCHEDULE_AI_INGESTION ?? "0 */2 * * *";
  cron.schedule(aiIngestion, async () => {
    await collectorsQueue.add("pipeline-run", {}, { jobId: `pipeline_${Date.now()}` });
  });

  // Lightweight guardrails still run more frequently.
  const quality = env.SCHEDULE_DATA_QUALITY ?? "*/20 * * * *";
  cron.schedule(quality, async () => {
    await qualityQueue.add("quality", {}, { jobId: `quality_${Date.now()}` });
  });

  const aiEstimation = env.SCHEDULE_AI_ESTIMATION ?? "30 */2 * * *";
  cron.schedule(aiEstimation, async () => {
    await aiEstimationQueue.add("ai-estimation", {}, { jobId: `fuse_${Date.now()}` });
  });
}
