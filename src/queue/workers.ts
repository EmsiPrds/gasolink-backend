import { Worker } from "bullmq";
import { redisConnection } from "./redis";
import { runAiSearchDataGathering } from "../jobs/aiSearchJob";
import { reconcileFuelRecords } from "../reconciliation/reconcileFuelRecords";
import { runAiPriceEstimation } from "../reconciliation/aiPriceEstimation";
import { runDataQualityMonitor } from "../quality/dataQualityMonitor";
import { UpdateLog } from "../models/UpdateLog";
import { normalizePendingRawSources } from "../pipeline/normalizeRawSources";

const connection = redisConnection();

export function startWorkers() {
  // Collectors worker
  new Worker(
    "collectors",
    async () => {
      await runAiSearchDataGathering();
      await normalizePendingRawSources({ limit: 100 });
    },
    { connection },
  );

  // Reconciliation worker
  new Worker(
    "reconcile",
    async () => {
      await normalizePendingRawSources({ limit: 200 });
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

