"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileFuelRecords = reconcileFuelRecords;
const NormalizedFuelRecord_1 = require("../models/NormalizedFuelRecord");
const FinalPublishedFuelPrice_1 = require("../models/FinalPublishedFuelPrice");
const UpdateLog_1 = require("../models/UpdateLog");
const fingerprint_1 = require("../normalization/fingerprint");
const staleness_1 = require("../normalization/staleness");
const dateInference_1 = require("../parsers/doe/dateInference");
function sourcePriority(sourceType) {
    switch (sourceType) {
        case "official_local":
            return 4;
        case "company_advisory":
            return 3;
        case "observed_station":
            return 2;
        case "estimate":
            return 1;
        case "global_api":
            return 0;
        default: {
            const _exhaustive = sourceType;
            return _exhaustive;
        }
    }
}
function displayTypeForSourceType(sourceType) {
    switch (sourceType) {
        case "official_local":
            return "ph_final";
        case "company_advisory":
            return "ph_company";
        case "observed_station":
        case "estimate":
        case "global_api":
            return null;
        default: {
            const _exhaustive = sourceType;
            return _exhaustive;
        }
    }
}
function buildPublishKey(doc) {
    return (0, fingerprint_1.buildFingerprint)({
        displayType: doc.displayType,
        fuelType: doc.fuelType,
        region: doc.region,
        city: doc.city ?? "",
        companyName: doc.companyName ?? "",
    });
}
function extractHost(url) {
    try {
        return new URL(url).hostname.toLowerCase();
    }
    catch {
        return url.toLowerCase();
    }
}
function isDirectCompanySource(item) {
    const host = extractHost(item.sourceUrl);
    const combined = `${item.sourceName} ${host}`;
    const companyKeywords = ["petron", "shell", "caltex", "seaoil", "unioil", "phoenix", "cleanfuel", "jetti", "ptt"];
    const newsHosts = ["gmanetwork.com", "abs-cbn.com", "philstar.com", "inquirer.net", "mb.com.ph", "rappler.com"];
    if (newsHosts.some((candidate) => host.includes(candidate)))
        return false;
    if (host.includes("facebook.com"))
        return companyKeywords.some((keyword) => combined.includes(keyword));
    return companyKeywords.some((keyword) => combined.includes(keyword));
}
function hasCorroborationForPublish(winner, items) {
    if (winner.sourceType === "official_local")
        return true;
    if (winner.sourceType !== "company_advisory")
        return false;
    if (!winner.effectiveAt && !winner.sourcePublishedAt)
        return false;
    const uniqueHosts = new Set(items.map((item) => extractHost(item.sourceUrl)));
    return items.some((item) => isDirectCompanySource(item)) || uniqueHosts.size >= 2;
}
function canonicalDocumentDate(doc) {
    return doc.effectiveAt ?? (0, dateInference_1.inferDoeDocumentDateFromUrl)(doc.sourceUrl) ?? doc.sourcePublishedAt ?? doc.scrapedAt ?? doc.updatedAt;
}
function candidateFreshness(doc) {
    return new Date(canonicalDocumentDate(doc)).getTime();
}
async function reconcileFuelRecords(params) {
    const now = new Date();
    const sinceMinutes = params?.sinceMinutes ?? 180;
    const from = new Date(now.getTime() - sinceMinutes * 60_000);
    const recentCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const candidates = await NormalizedFuelRecord_1.NormalizedFuelRecord.find({
        updatedAt: { $gte: from },
        $or: [
            { effectiveAt: { $gte: recentCutoff } },
            { sourcePublishedAt: { $gte: recentCutoff } },
        ]
    }).sort({ confidenceScore: -1 }).lean();
    const fuelTypes = Array.from(new Set(candidates.map((candidate) => candidate.fuelType)));
    const regions = Array.from(new Set(candidates.map((candidate) => candidate.region)));
    const latestPriceDocs = fuelTypes.length > 0 && regions.length > 0
        ? await FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.find({
            fuelType: { $in: fuelTypes },
            region: { $in: regions },
            displayType: "ph_final",
            companyName: { $in: [null, ""] },
            city: { $in: [null, ""] },
            finalPrice: { $ne: null },
        }, { fuelType: 1, region: 1, finalPrice: 1, lastVerifiedAt: 1 })
            .sort({ lastVerifiedAt: -1 })
            .lean()
        : [];
    const latestPriceByFuelRegion = new Map();
    for (const doc of latestPriceDocs) {
        const key = `${doc.fuelType}::${doc.region}`;
        if (!latestPriceByFuelRegion.has(key) && typeof doc.finalPrice === "number") {
            latestPriceByFuelRegion.set(key, doc.finalPrice);
        }
    }
    // Group by fuelType+region+city+companyName.
    // This avoids mixing "official regional" with "company advisory" with "observed station" into a single competition.
    const groups = new Map();
    for (const c of candidates) {
        const key = `${c.fuelType}::${c.region}::${c.city ?? ""}::${c.companyName ?? ""}`;
        const arr = groups.get(key) ?? [];
        arr.push(c);
        groups.set(key, arr);
    }
    const operations = [];
    for (const [, items] of groups) {
        const sorted = items
            .slice()
            .sort((a, b) => {
            const ap = sourcePriority(a.sourceType);
            const bp = sourcePriority(b.sourceType);
            if (ap !== bp)
                return bp - ap;
            if (a.confidenceScore !== b.confidenceScore)
                return b.confidenceScore - a.confidenceScore;
            const at = candidateFreshness(a);
            const bt = candidateFreshness(b);
            if (at !== bt)
                return bt - at;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        const winner = sorted[0];
        if (!winner)
            continue;
        // Calculate average price from all candidates with a pricePerLiter
        const itemsWithPrice = items.filter((item) => typeof item.pricePerLiter === "number");
        const averagePrice = itemsWithPrice.length > 0
            ? itemsWithPrice.reduce((sum, item) => sum + (item.pricePerLiter ?? 0), 0) / itemsWithPrice.length
            : null;
        const displayType = displayTypeForSourceType(winner.sourceType);
        if (!displayType)
            continue;
        if (!hasCorroborationForPublish(winner, items))
            continue;
        const publishKey = buildPublishKey({
            displayType,
            fuelType: winner.fuelType,
            region: winner.region,
            city: winner.city,
            companyName: winner.companyName,
        });
        const supportingSources = sorted.slice(0, 5).map((s) => ({
            normalizedRecordId: s._id,
            sourceType: s.sourceType,
            sourceName: s.sourceName,
            sourceUrl: s.sourceUrl,
            sourcePublishedAt: s.sourcePublishedAt,
            scrapedAt: s.scrapedAt,
            parserVersion: "v1",
            confidenceScore: s.confidenceScore,
            statusLabel: s.statusLabel,
        }));
        const lastVerifiedAt = canonicalDocumentDate(winner);
        let finalPrice = typeof winner.pricePerLiter === "number" ? winner.pricePerLiter : null;
        // If we have a priceChange but not a final price, estimate it from the last known price
        if (finalPrice === null && typeof winner.priceChange === "number") {
            const lastPrice = latestPriceByFuelRegion.get(`${winner.fuelType}::${winner.region}`);
            if (typeof lastPrice === "number") {
                finalPrice = lastPrice + winner.priceChange;
            }
        }
        // Staleness gating (fail closed): do not publish stale advisory/observed/estimate.
        if ((0, staleness_1.isStale)(winner.sourceType, new Date(lastVerifiedAt), now) && winner.sourceType !== "official_local") {
            continue;
        }
        operations.push({
            updateOne: {
                filter: { publishKey },
                update: {
                    $set: {
                        displayType,
                        companyName: winner.companyName,
                        fuelType: winner.fuelType,
                        region: winner.region,
                        city: winner.city,
                        finalPrice: finalPrice,
                        averagePrice: averagePrice ?? null,
                        priceChange: winner.priceChange,
                        currency: winner.currency ?? "PHP",
                        supportingSources,
                        finalStatus: winner.statusLabel,
                        confidenceScore: winner.confidenceScore,
                        lastVerifiedAt,
                        updatedAt: now,
                        publishKey,
                    },
                },
                upsert: true,
            },
        });
    }
    if (operations.length > 0) {
        await FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.bulkWrite(operations, { ordered: false });
    }
    const upserted = operations.length;
    await UpdateLog_1.UpdateLog.create({
        module: "reconciliation",
        status: "success",
        message: `Reconciliation complete. groups=${groups.size} upserted=${upserted}`,
        timestamp: now,
    });
    return { ok: true, groups: groups.size, upserted };
}
