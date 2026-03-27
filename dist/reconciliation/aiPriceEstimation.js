"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confidenceLabel = confidenceLabel;
exports.removeOutliers = removeOutliers;
exports.clamp = clamp;
exports.runAiPriceEstimation = runAiPriceEstimation;
const NormalizedFuelRecord_1 = require("../models/NormalizedFuelRecord");
const FinalPublishedFuelPrice_1 = require("../models/FinalPublishedFuelPrice");
const FuelPricePH_1 = require("../models/FuelPricePH");
const enums_1 = require("../models/enums");
const UpdateLog_1 = require("../models/UpdateLog");
const env_1 = require("../config/env");
const doeLatestPolicy_1 = require("../utils/doeLatestPolicy");
const RawScrapedSource_1 = require("../models/RawScrapedSource");
const MAX_DOE_DOC_AGE_DAYS = 14;
function defaultBaselinePrice(fuelType) {
    if (fuelType === "Gasoline")
        return 65;
    if (fuelType === "Diesel")
        return 60;
    return 75; // Kerosene
}
function average(values) {
    if (!values.length)
        return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function median(values) {
    if (!values.length)
        return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function quantile(values, q) {
    if (!values.length)
        return null;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (sorted.length - 1) * q;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper)
        return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}
function confidenceLabel(score) {
    if (score >= 0.9)
        return "Very High";
    if (score >= 0.75)
        return "High";
    if (score >= 0.55)
        return "Medium";
    return "Low";
}
function sourceWeight(category) {
    if (category === "doe_official")
        return 0.45;
    if (category === "global_api")
        return 0.2;
    if (category === "web_scrape")
        return 0.22;
    return 0.13;
}
function candidateTimestamp(candidate) {
    return candidate.effectiveAt ?? candidate.sourcePublishedAt ?? candidate.scrapedAt;
}
function isWithinRange(candidate) {
    if (typeof candidate.pricePerLiter === "number")
        return candidate.pricePerLiter >= 30 && candidate.pricePerLiter <= 120;
    if (typeof candidate.priceChange === "number")
        return candidate.priceChange >= -15 && candidate.priceChange <= 15;
    return false;
}
function removeOutliers(values) {
    if (values.length < 4)
        return values;
    const q1 = quantile(values, 0.25);
    const q3 = quantile(values, 0.75);
    if (q1 == null || q3 == null)
        return values;
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    return values.filter((value) => value >= lower && value <= upper);
}
function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
}
function computeFreshnessHours(candidates, now) {
    if (!candidates.length)
        return null;
    const latestTs = Math.max(...candidates.map((candidate) => candidateTimestamp(candidate).getTime()));
    return Math.max(0, (now.getTime() - latestTs) / (1000 * 60 * 60));
}
async function runAiPriceEstimation() {
    if (env_1.env.ENABLE_NEW_ESTIMATOR === "false")
        return { estimations: 0, skipped: true };
    const now = new Date();
    const from = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000);
    const activeRawDoe = await RawScrapedSource_1.RawScrapedSource.findOne({
        sourceType: "official_local",
        aiSelectedLatest: true,
        aiDocumentDate: { $gte: from, $lte: now },
    })
        .sort({ aiDocumentDate: -1, scrapedAt: -1 })
        .select({ sourceUrl: 1 })
        .lean();
    const activeDoeUrl = activeRawDoe?.sourceUrl ? (0, doeLatestPolicy_1.normalizeSourceUrl)(String(activeRawDoe.sourceUrl)) : null;
    let estimations = 0;
    for (const region of enums_1.RegionValues) {
        for (const fuelType of enums_1.FuelTypeValues) {
            if (!activeDoeUrl) {
                await UpdateLog_1.UpdateLog.create({
                    module: "ai_estimation",
                    status: "failure",
                    message: `DOE freshness guard blocked: no active DOE doc within ${MAX_DOE_DOC_AGE_DAYS} days for ${fuelType}/${region}.`,
                    timestamp: now,
                }).catch(() => { });
                continue;
            }
            const candidates = (await NormalizedFuelRecord_1.NormalizedFuelRecord.find({
                region,
                fuelType,
                sourceType: "official_local",
                sourceUrl: { $regex: /.*/ },
                $or: [
                    { effectiveAt: { $gte: from } },
                    { sourcePublishedAt: { $gte: from } },
                ],
            })
                .sort({ confidenceScore: -1, scrapedAt: -1 })
                .lean());
            const validCandidates = candidates.filter(isWithinRange);
            const latestDocCandidates = validCandidates.filter((candidate) => {
                const docDate = (0, doeLatestPolicy_1.resolveDoeDocumentDate)(candidate.sourceUrl, candidate.effectiveAt ?? candidate.sourcePublishedAt);
                if (!docDate || docDate < from)
                    return false;
                return (0, doeLatestPolicy_1.normalizeSourceUrl)(candidate.sourceUrl) === activeDoeUrl;
            });
            if (!latestDocCandidates.length)
                continue;
            const baseline = await FuelPricePH_1.FuelPricePH.findOne({ fuelType, region }).sort({ updatedAt: -1 }).lean();
            const baselinePrice = typeof baseline?.price === "number" && Number.isFinite(baseline.price) ? baseline.price : defaultBaselinePrice(fuelType);
            const withDerivedPrice = latestDocCandidates
                .map((candidate) => {
                const derived = typeof candidate.pricePerLiter === "number" ? candidate.pricePerLiter : baselinePrice + (candidate.priceChange ?? 0);
                return { ...candidate, derivedPrice: derived, sourceCategory: "doe_official" };
            })
                .filter((candidate) => Number.isFinite(candidate.derivedPrice));
            const cleanedPrices = removeOutliers(withDerivedPrice.map((candidate) => candidate.derivedPrice));
            const cleanedSet = new Set(cleanedPrices.map((price) => price.toFixed(4)));
            const cleanedCandidates = withDerivedPrice.filter((candidate) => cleanedSet.has(candidate.derivedPrice.toFixed(4)));
            if (!cleanedCandidates.length)
                continue;
            const weighted = cleanedCandidates.reduce((acc, candidate) => {
                const recencyHours = (now.getTime() - candidateTimestamp(candidate).getTime()) / (1000 * 60 * 60);
                const recencyFactor = clamp(1 - recencyHours / (24 * 10), 0.2, 1);
                const weight = sourceWeight(candidate.sourceCategory) * clamp(candidate.confidenceScore, 0.1, 1) * recencyFactor;
                return {
                    weightedSum: acc.weightedSum + candidate.derivedPrice * weight,
                    totalWeight: acc.totalWeight + weight,
                };
            }, { weightedSum: 0, totalWeight: 0 });
            let deterministicEstimate = weighted.totalWeight > 0 ? weighted.weightedSum / weighted.totalWeight : median(cleanedCandidates.map((candidate) => candidate.derivedPrice));
            if (deterministicEstimate == null || !Number.isFinite(deterministicEstimate))
                deterministicEstimate = baselinePrice;
            // DOE-only mode: no global/web/user adjustments.
            const explanation = `Based on latest DOE document within ${MAX_DOE_DOC_AGE_DAYS} days (${cleanedCandidates.length} records).`;
            const finalEstimate = deterministicEstimate;
            const aiConfidenceBoost = 0;
            const byCategory = new Map();
            for (const candidate of cleanedCandidates) {
                const list = byCategory.get(candidate.sourceCategory) ?? [];
                list.push(candidate);
                byCategory.set(candidate.sourceCategory, list);
            }
            const sourceBreakdown = Array.from(byCategory.entries()).map(([sourceCategory, list]) => ({
                sourceCategory,
                sampleSize: list.length,
                avgConfidence: average(list.map((item) => item.confidenceScore)) ?? 0,
                avgPrice: average(list.map((item) => item.derivedPrice)) ?? undefined,
                freshnessHours: computeFreshnessHours(list, now) ?? undefined,
            }));
            const agreementSpread = (() => {
                const prices = cleanedCandidates.map((candidate) => candidate.derivedPrice);
                return prices.length > 1 ? (Math.max(...prices) - Math.min(...prices)) / Math.max(1, average(prices) ?? 1) : 0;
            })();
            const freshnessHours = computeFreshnessHours(cleanedCandidates, now) ?? 999;
            const avgSourceConfidence = average(cleanedCandidates.map((candidate) => candidate.confidenceScore)) ?? 0.3;
            const sampleScore = clamp(cleanedCandidates.length / 10, 0, 1);
            const agreementScore = clamp(1 - agreementSpread, 0, 1);
            const freshnessScore = clamp(1 - freshnessHours / (24 * 7), 0, 1);
            const finalConfidence = clamp(0.35 * avgSourceConfidence + 0.25 * agreementScore + 0.25 * freshnessScore + 0.15 * sampleScore + aiConfidenceBoost, 0.2, 0.98);
            const supportingCandidates = cleanedCandidates.slice(0, 8);
            const publishKey = `fused_est::${fuelType}::${region}`;
            await FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.findOneAndUpdate({ publishKey }, {
                displayType: "ph_final",
                fuelType,
                region,
                finalPrice: finalEstimate,
                averagePrice: average(cleanedCandidates.map((candidate) => candidate.derivedPrice)) ?? finalEstimate,
                priceChange: finalEstimate - baselinePrice,
                finalStatus: "Official",
                confidenceScore: finalConfidence,
                confidenceLabel: confidenceLabel(finalConfidence),
                estimateExplanation: explanation,
                sourceBreakdown,
                lastVerifiedAt: now,
                updatedAt: now,
                publishKey,
                supportingSources: supportingCandidates.map((candidate) => ({
                    normalizedRecordId: candidate._id,
                    sourceType: candidate.sourceType,
                    sourceName: candidate.sourceName,
                    sourceUrl: candidate.sourceUrl,
                    sourcePublishedAt: candidate.sourcePublishedAt,
                    scrapedAt: candidate.scrapedAt,
                    parserVersion: "fused_v1",
                    confidenceScore: candidate.confidenceScore,
                    statusLabel: candidate.statusLabel,
                })),
            }, { upsert: true });
            estimations++;
        }
    }
    await UpdateLog_1.UpdateLog.create({
        module: "ai_estimation",
        status: "success",
        message: `Fusion estimation finished. created/updated ${estimations} estimates.`,
        timestamp: now,
    });
    return { estimations };
}
