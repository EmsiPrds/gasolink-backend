"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAccuracyFirstCollection = runAccuracyFirstCollection;
const FinalPublishedFuelPrice_1 = require("../models/FinalPublishedFuelPrice");
const NormalizedFuelRecord_1 = require("../models/NormalizedFuelRecord");
const normalizeRawSources_1 = require("../pipeline/normalizeRawSources");
const sourceCollectionService_1 = require("../services/sourceCollectionService");
const aiSearchJob_1 = require("./aiSearchJob");
function combineNormalizationSummaries(a, b) {
    return {
        passes: a.passes + b.passes,
        processed: a.processed + b.processed,
        normalized: a.normalized + b.normalized,
        failed: a.failed + b.failed,
    };
}
async function runAccuracyFirstCollection() {
    const officialCollection = await (0, sourceCollectionService_1.runConfiguredSourceCollection)({ scope: "official" });
    let normalization = await (0, normalizeRawSources_1.drainPendingRawSources)({ limitPerPass: 150, maxPasses: 6 });
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const freshOfficialNormalized = await NormalizedFuelRecord_1.NormalizedFuelRecord.countDocuments({
        sourceType: "official_local",
        updatedAt: { $gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) },
    });
    const latestOfficialHeadline = await FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.findOne({
        displayType: "ph_final",
        companyName: { $in: [null, ""] },
        city: { $in: [null, ""] },
    })
        .sort({ lastVerifiedAt: -1 })
        .select({ lastVerifiedAt: 1 })
        .lean();
    let aiFallback = {
        ran: false,
    };
    const shouldRunAiFallback = freshOfficialNormalized === 0 &&
        (!latestOfficialHeadline ||
            !latestOfficialHeadline.lastVerifiedAt ||
            new Date(latestOfficialHeadline.lastVerifiedAt).getTime() < fiveDaysAgo.getTime());
    if (shouldRunAiFallback) {
        aiFallback = {
            ...(await (0, aiSearchJob_1.runAiSearchDataGathering)({
                skipReconcile: true,
                degradeToEstimate: true,
                requireEffectivity: true,
                requireRegion: true,
            })),
            ran: true,
            reason: "No fresh official headline price was available, so AI fallback gathered supporting estimate-only records.",
        };
        const fallbackNormalization = await (0, normalizeRawSources_1.drainPendingRawSources)({ limitPerPass: 100, maxPasses: 3 });
        normalization = combineNormalizationSummaries(normalization, fallbackNormalization);
    }
    return {
        officialCollection: officialCollection,
        normalization,
        aiFallback,
    };
}
