import { UpdateLog } from "../models/UpdateLog";
import { runAiPriceEstimation } from "./aiPriceEstimation";

export async function reconcileFuelRecords(params?: { sinceMinutes?: number }) {
  const now = new Date();
  const estimation = await runAiPriceEstimation();
  await UpdateLog.create({
    module: "reconciliation",
    status: "success",
    message: `Legacy rule-based reconciliation skipped. AI-native estimation updated ${estimation.estimations} records.`,
    timestamp: now,
  });
  return { ok: true as const, groups: 0, upserted: estimation.estimations, mode: "ai_native" as const, params };
}
