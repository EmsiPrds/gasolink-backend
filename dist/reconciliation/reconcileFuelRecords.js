"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileFuelRecords = reconcileFuelRecords;
const NormalizedFuelRecord_1 = require("../models/NormalizedFuelRecord");
const FinalPublishedFuelPrice_1 = require("../models/FinalPublishedFuelPrice");
const UpdateLog_1 = require("../models/UpdateLog");
const fingerprint_1 = require("../normalization/fingerprint");
const staleness_1 = require("../normalization/staleness");
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
function buildPublishKey(doc) {
    return (0, fingerprint_1.buildFingerprint)({
        displayType: doc.displayType,
        fuelType: doc.fuelType,
        region: doc.region,
        city: doc.city ?? "",
        companyName: doc.companyName ?? "",
    });
}
async function reconcileFuelRecords(params) {
    const now = new Date();
    const sinceMinutes = params?.sinceMinutes ?? 180;
    const from = new Date(now.getTime() - sinceMinutes * 60_000);
    const candidates = await NormalizedFuelRecord_1.NormalizedFuelRecord.find({ updatedAt: { $gte: from } }).sort({ confidenceScore: -1 }).lean();
    // Group by fuelType+region+city+companyName.
    // This avoids mixing "official regional" with "company advisory" with "observed station" into a single competition.
    const groups = new Map();
    for (const c of candidates) {
        const key = `${c.fuelType}::${c.region}::${c.city ?? ""}::${c.companyName ?? ""}`;
        const arr = groups.get(key) ?? [];
        arr.push(c);
        groups.set(key, arr);
    }
    let upserted = 0;
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
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        const winner = sorted[0];
        if (!winner)
            continue;
        const displayType = winner.sourceType === "company_advisory"
            ? "ph_company"
            : winner.sourceType === "observed_station"
                ? "ph_observed"
                : "ph_final";
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
        const lastVerifiedAt = winner.sourcePublishedAt ?? winner.scrapedAt ?? winner.updatedAt ?? now;
        // Staleness gating (fail closed): do not publish stale advisory/observed/estimate.
        if ((0, staleness_1.isStale)(winner.sourceType, new Date(lastVerifiedAt), now) && winner.sourceType !== "official_local") {
            continue;
        }
        await FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.findOneAndUpdate({ publishKey }, {
            displayType,
            companyName: winner.companyName,
            fuelType: winner.fuelType,
            region: winner.region,
            city: winner.city,
            finalPrice: typeof winner.pricePerLiter === "number" ? winner.pricePerLiter : null,
            priceChange: winner.priceChange,
            currency: winner.currency ?? "PHP",
            supportingSources,
            finalStatus: winner.statusLabel,
            confidenceScore: winner.confidenceScore,
            lastVerifiedAt,
            updatedAt: now,
            publishKey,
        }, { upsert: true, new: true });
        upserted += 1;
    }
    await UpdateLog_1.UpdateLog.create({
        module: "reconciliation",
        status: "success",
        message: `Reconciliation complete. groups=${groups.size} upserted=${upserted}`,
        timestamp: now,
    });
    return { ok: true, groups: groups.size, upserted };
}
