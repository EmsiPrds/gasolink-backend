import { Worker } from "bullmq";
import { redisConnection } from "./redis";
import { runAccuracyFirstCollection } from "../jobs/accuracyCollectionJob";
import { reconcileFuelRecords } from "../reconciliation/reconcileFuelRecords";
import { runAiPriceEstimation } from "../reconciliation/aiPriceEstimation";
import { runDataQualityMonitor } from "../quality/dataQualityMonitor";
import { UpdateLog } from "../models/UpdateLog";
import { drainPendingRawSources } from "../pipeline/normalizeRawSources";

const connection = redisConnection();

export function startWorkers() {
  // Collectors worker
  new Worker(
    "collectors",
    async () => {
      try {
        const collection = await runAccuracyFirstCollection();
        const reconcileResult = await reconcileFuelRecords();
        await UpdateLog.create({
          module: "collectors",
          status: "success",
          message: `Collectors finished. officialCreated=${collection.officialCollection.created} officialSkipped=${collection.officialCollection.skippedUnchanged} normalized=${collection.normalization.normalized} failed=${collection.normalization.failed} reconciled=${reconcileResult.upserted} aiFallback=${collection.aiFallback.ran ? "yes" : "no"}`,
          timestamp: new Date(),
        }).catch(() => {});
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await UpdateLog.create({
          module: "collectors",
          status: "failure",
          message: `Collectors failed: ${message}`,
          timestamp: new Date(),
        }).catch(() => {});
        throw error;
      }
    },
    { connection },
  );

  // Reconciliation worker
  new Worker(
    "reconcile",
    async () => {
      await drainPendingRawSources({ limitPerPass: 150, maxPasses: 6 });
      await reconcileFuelRecords();
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
    message: "Workers started (collectors, reconcile, quality, ai-estimation).",
    timestamp: new Date(),
  }).catch(() => {});
}
