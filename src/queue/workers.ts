import { Worker } from "bullmq";
import { redisConnection } from "./redis";
import { runAiPriceEstimation } from "../reconciliation/aiPriceEstimation";
import { runDataQualityMonitor } from "../quality/dataQualityMonitor";
import { UpdateLog } from "../models/UpdateLog";
import { drainPendingRawSources } from "../pipeline/normalizeRawSources";
import { cleanupOutdatedDoeData } from "../services/doeLatestCleanupService";

const connection = redisConnection();

export function startWorkers() {
  // Manual DOE ingestion worker:
  // consumes admin-uploaded raws, normalizes, then publishes fused outputs.
  new Worker(
    "collectors",
    async () => {
      try {
        const normalizeResult = await drainPendingRawSources({ limitPerPass: 100, maxPasses: 3 });
        await runDataQualityMonitor();
        const estimationResult = await runAiPriceEstimation();
        const cleanup = await cleanupOutdatedDoeData();
        await UpdateLog.create({
          module: "pipeline_run",
          status: "success",
          message: `DOE manual pipeline finished. normalized=${normalizeResult.normalized} normalizeFailed=${normalizeResult.failed} estimates=${estimationResult.estimations} cleanupNormalized=${cleanup.deletedNormalized} cleanupPublished=${cleanup.deletedPublished}`,
          timestamp: new Date(),
        }).catch(() => {});
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await UpdateLog.create({
          module: "pipeline_run",
          status: "failure",
          message: `Pipeline failed: ${message}`,
          timestamp: new Date(),
        }).catch(() => {});
        throw error;
      }
    },
    { connection },
  );

  // Data quality worker
  new Worker(
    "quality",
    async () => {
      await runDataQualityMonitor();
    },
    { connection },
  );

  // AI Estimation worker
  new Worker(
    "ai-estimation",
    async () => {
      await runAiPriceEstimation();
    },
    { connection },
  );

  UpdateLog.create({
    module: "workers",
    status: "success",
    message: "Workers started (pipeline-run, quality, ai-estimation).",
    timestamp: new Date(),
  }).catch(() => {});
}
