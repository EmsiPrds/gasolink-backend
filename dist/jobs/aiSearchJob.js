"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAiSearchDataGathering = runAiSearchDataGathering;
const aiService_1 = require("../services/aiService");
const NormalizedFuelRecord_1 = require("../models/NormalizedFuelRecord");
const UpdateLog_1 = require("../models/UpdateLog");
const fingerprint_1 = require("../normalization/fingerprint");
const validators_1 = require("../normalization/validators");
const reconcileFuelRecords_1 = require("../reconciliation/reconcileFuelRecords");
function isKnownCompanySource(sourceName, sourceUrl) {
    const combined = `${sourceName} ${sourceUrl}`.toLowerCase();
    return [
        "petron",
        "shell",
        "caltex",
        "seaoil",
        "unioil",
        "phoenix",
        "cleanfuel",
        "jetti",
        "ptt",
        "total",
    ].some((keyword) => combined.includes(keyword));
}
async function runAiSearchDataGathering(options) {
    console.log("==> Starting AI-driven supporting search data gathering...");
    try {
        const aiResult = await (0, aiService_1.searchAndExtractFuelPricesWithAi)();
        if (!aiResult || aiResult.items.length === 0) {
            await UpdateLog_1.UpdateLog.create({
                module: "ai_search_job",
                status: "success",
                message: "AI fallback search completed but no supporting fuel data items were found.",
                timestamp: new Date(),
            });
            return { savedCount: 0, scannedCount: 0 };
        }
        const scrapedAt = new Date();
        const seenFingerprints = new Set();
        const operations = [];
        for (const item of aiResult.items) {
            // Basic validation: ensure we have at least a price or a change
            if (item.pricePerLiter == null && item.priceChange == null) {
                continue;
            }
            if ((options?.requireEffectivity ?? true) && !item.effectiveAt) {
                continue;
            }
            if ((options?.requireRegion ?? true) && !item.region) {
                continue;
            }
            let sourceType = "estimate";
            let statusLabel = "Estimate";
            if (!options?.degradeToEstimate && isKnownCompanySource(item.sourceName, item.sourceUrl)) {
                sourceType = "company_advisory";
                statusLabel = "Advisory";
            }
            const region = item.region;
            if (!region)
                continue;
            const confidenceScore = sourceType === "company_advisory"
                ? Math.min(0.65, Math.max(0.25, aiResult.confidence * 0.65))
                : Math.min(0.45, Math.max(0.1, aiResult.confidence * 0.45));
            const candidate = {
                sourceType,
                statusLabel,
                confidenceScore,
                fuelType: item.fuelType,
                region,
                city: item.city || undefined,
                pricePerLiter: item.pricePerLiter ?? undefined,
                priceChange: item.priceChange ?? undefined,
                currency: "PHP",
                sourceName: item.sourceName,
                sourceUrl: item.sourceUrl,
                scrapedAt,
                effectiveAt: item.effectiveAt ? new Date(item.effectiveAt) : undefined,
                sourcePublishedAt: item.effectiveAt ? new Date(item.effectiveAt) : undefined,
                companyName: item.companyName || undefined,
                productName: item.productName || undefined,
            };
            const validated = (0, validators_1.validateCandidate)(candidate);
            const fingerprint = (0, fingerprint_1.buildFingerprint)({
                sourceType: validated.sourceType,
                sourceUrl: validated.sourceUrl,
                sourcePublishedAt: validated.sourcePublishedAt ? validated.sourcePublishedAt.toISOString() : "",
                fuelType: validated.fuelType,
                region: validated.region,
                city: validated.city ?? "",
                pricePerLiter: validated.pricePerLiter ?? "",
                priceChange: validated.priceChange ?? "",
                effectiveAt: validated.effectiveAt ? validated.effectiveAt.toISOString() : "",
            });
            if (seenFingerprints.has(fingerprint))
                continue;
            seenFingerprints.add(fingerprint);
            operations.push({
                updateOne: {
                    filter: { fingerprint },
                    update: {
                        $setOnInsert: {
                            ...validated,
                            fingerprint,
                        },
                    },
                    upsert: true,
                },
            });
        }
        const bulkResult = operations.length > 0
            ? await NormalizedFuelRecord_1.NormalizedFuelRecord.bulkWrite(operations, { ordered: false })
            : null;
        const savedCount = bulkResult?.upsertedCount ?? 0;
        await UpdateLog_1.UpdateLog.create({
            module: "ai_search_job",
            status: "success",
            message: `AI fallback search finished. created ${savedCount} new estimate/supporting records.`,
            timestamp: new Date(),
        });
        if (!options?.skipReconcile) {
            console.log("==> Triggering automatic reconciliation after AI fallback search...");
            await (0, reconcileFuelRecords_1.reconcileFuelRecords)();
        }
        return { savedCount, scannedCount: aiResult.items.length };
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Error in AI search job:", msg);
        await UpdateLog_1.UpdateLog.create({
            module: "ai_search_job",
            status: "failure",
            message: `AI search job failed: ${msg}`,
            timestamp: new Date(),
        });
        throw error;
    }
}
