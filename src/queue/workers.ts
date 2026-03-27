import { Worker } from "bullmq";
import { redisConnection } from "./redis";
import { runAiPriceEstimation } from "../reconciliation/aiPriceEstimation";
import { runDataQualityMonitor } from "../quality/dataQualityMonitor";
import { UpdateLog } from "../models/UpdateLog";
import { drainPendingRawSources } from "../pipeline/normalizeRawSources";
import { runConfiguredSourceCollection } from "../services/sourceCollectionService";
import { cleanupOutdatedDoeData } from "../services/doeLatestCleanupService";

const connection = redisConnection();

export function startWorkers() {
  // AI ingestion worker (legacy collectors queue retained for compatibility)
  new Worker(
    "collectors",
    async () => {
      try {
        const collectionResult = await runConfiguredSourceCollection({ scope: "official" });
        const normalizeResult = await drainPendingRawSources({ limitPerPass: 100, maxPasses: 3 });
        await runDataQualityMonitor();
        const estimationResult = await runAiPriceEstimation();
        const cleanup = await cleanupOutdatedDoeData();
        await UpdateLog.create({
          module: "pipeline_run",
          status: "success",
          message: `DOE-only pipeline finished. collected=${collectionResult.created}/${collectionResult.attempted} rawFailed=${collectionResult.failed} normalized=${normalizeResult.normalized} normalizeFailed=${normalizeResult.failed} estimates=${estimationResult.estimations} cleanupNormalized=${cleanup.deletedNormalized} cleanupPublished=${cleanup.deletedPublished}`,
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
