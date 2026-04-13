import cron from "node-cron";
import { env } from "../config/env";
import { qualityQueue, aiEstimationQueue } from "../queue/queues";
import { UpdateLog } from "../models/UpdateLog";

export function startPipelineJobs() {
  // DOE ingest is now manual-admin driven. Keep a startup log so operators know why no cron is running.
  UpdateLog.create({
    module: "pipeline_jobs",
    status: "success",
    message: "DOE collection cron disabled. Use Admin DOE upload flow for ingestion.",
    timestamp: new Date(),
  }).catch(() => {});

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
