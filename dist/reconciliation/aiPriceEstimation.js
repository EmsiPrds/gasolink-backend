"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAiPriceEstimation = runAiPriceEstimation;
const NormalizedFuelRecord_1 = require("../models/NormalizedFuelRecord");
const FinalPublishedFuelPrice_1 = require("../models/FinalPublishedFuelPrice");
const GlobalPrice_1 = require("../models/GlobalPrice");
const aiService_1 = require("../services/aiService");
const enums_1 = require("../models/enums");
const UpdateLog_1 = require("../models/UpdateLog");
async function runAiPriceEstimation() {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000); // look at last 24h
    const globalPrices = await GlobalPrice_1.GlobalPrice.find({ timestamp: { $gte: from } }).sort({ timestamp: -1 });
    let estimations = 0;
    for (const region of enums_1.RegionValues) {
        for (const fuelType of enums_1.FuelTypeValues) {
            // Find all candidates for this region/fuel combination from last 30 days.
            // We use effectiveAt or sourcePublishedAt to ensure we don't pick up old archives.
            const candidates = await NormalizedFuelRecord_1.NormalizedFuelRecord.find({
                region,
                fuelType,
                $or: [
                    { effectiveAt: { $gte: from } },
                    { sourcePublishedAt: { $gte: from } },
                ],
            }).sort({ confidenceScore: -1 }).lean();
            if (candidates.length === 0)
                continue;
            // Call AI to refine the estimate
            const result = await (0, aiService_1.refinePriceWithAi)(fuelType, region, candidates, globalPrices);
            if (!result)
                continue;
            const publishKey = `ai_est::${fuelType}::${region}`;
            await FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.findOneAndUpdate({ publishKey }, {
                displayType: "ph_ai_estimate",
                fuelType,
                region,
                finalPrice: result.estimatedPrice,
                finalStatus: "Estimate",
                confidenceScore: result.confidence,
                lastVerifiedAt: now,
                updatedAt: now,
                publishKey,
                // Store AI reasoning as a note in supportingSources if needed, or just keep it in logs.
                supportingSources: candidates.slice(0, 5).map(c => ({
                    normalizedRecordId: c._id,
                    sourceType: c.sourceType,
                    sourceName: c.sourceName,
                    sourceUrl: c.sourceUrl,
                    scrapedAt: c.scrapedAt,
                    parserVersion: "ai_v1",
                    confidenceScore: c.confidenceScore,
                    statusLabel: c.statusLabel,
                })),
            }, { upsert: true });
            estimations++;
        }
    }
    await UpdateLog_1.UpdateLog.create({
        module: "ai_estimation",
        status: "success",
        message: `AI Price Estimation finished. created/updated ${estimations} estimates.`,
        timestamp: now,
    });
    return { estimations };
}
