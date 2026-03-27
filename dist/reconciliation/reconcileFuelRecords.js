"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileFuelRecords = reconcileFuelRecords;
const UpdateLog_1 = require("../models/UpdateLog");
const aiPriceEstimation_1 = require("./aiPriceEstimation");
async function reconcileFuelRecords(params) {
    const now = new Date();
    const estimation = await (0, aiPriceEstimation_1.runAiPriceEstimation)();
    await UpdateLog_1.UpdateLog.create({
        module: "reconciliation",
        status: "success",
        message: `Legacy rule-based reconciliation skipped. AI-native estimation updated ${estimation.estimations} records.`,
        timestamp: now,
    });
    return { ok: true, groups: 0, upserted: estimation.estimations, mode: "ai_native", params };
}
