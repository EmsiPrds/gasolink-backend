"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOutdatedDoeData = cleanupOutdatedDoeData;
const FinalPublishedFuelPrice_1 = require("../models/FinalPublishedFuelPrice");
const NormalizedFuelRecord_1 = require("../models/NormalizedFuelRecord");
const RawScrapedSource_1 = require("../models/RawScrapedSource");
const doeLatestPolicy_1 = require("../utils/doeLatestPolicy");
const MAX_DOE_DOC_AGE_DAYS = 14;
async function cleanupOutdatedDoeData() {
    const now = new Date();
    const from = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000);
    const activeRawDoe = await RawScrapedSource_1.RawScrapedSource.findOne({
        sourceType: "official_local",
        aiSelectedLatest: true,
        aiDocumentDate: { $gte: from, $lte: now },
    })
        .sort({ aiDocumentDate: -1, scrapedAt: -1 })
        .select({ sourceUrl: 1, aiDocumentDate: 1, aiConfidence: 1, aiReason: 1 })
        .lean();
    const activeUrl = activeRawDoe?.sourceUrl ? (0, doeLatestPolicy_1.normalizeSourceUrl)(String(activeRawDoe.sourceUrl)) : null;
    if (!activeUrl) {
        const oldDelete = await NormalizedFuelRecord_1.NormalizedFuelRecord.deleteMany({
            sourceType: "official_local",
            $or: [{ effectiveAt: { $lt: from } }, { sourcePublishedAt: { $lt: from } }],
        });
        return { deletedNormalized: oldDelete.deletedCount ?? 0, deletedPublished: 0, activeDoeDocument: null };
    }
    const keepIds = (await NormalizedFuelRecord_1.NormalizedFuelRecord.find({
        sourceType: "official_local",
        $or: [{ effectiveAt: { $gte: from } }, { sourcePublishedAt: { $gte: from } }],
        sourceUrl: { $exists: true },
    })
        .select({ _id: 1, sourceUrl: 1 })
        .limit(5000)
        .lean())
        .filter((record) => (0, doeLatestPolicy_1.normalizeSourceUrl)(String(record.sourceUrl ?? "")) === activeUrl)
        .map((record) => record._id);
    const normalizedDelete = await NormalizedFuelRecord_1.NormalizedFuelRecord.deleteMany({
        sourceType: "official_local",
        _id: { $nin: keepIds },
    });
    const publishedDocs = await FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.find({ finalStatus: "Official" })
        .select({ _id: 1, supportingSources: 1, updatedAt: 1 })
        .limit(2000)
        .lean();
    const deletePublishedIds = publishedDocs
        .filter((doc) => {
        if (!doc.updatedAt || doc.updatedAt < from)
            return true;
        const officialSource = (doc.supportingSources ?? []).find((src) => src.sourceType === "official_local");
        if (!officialSource?.sourceUrl)
            return true;
        return (0, doeLatestPolicy_1.normalizeSourceUrl)(String(officialSource.sourceUrl)) !== activeUrl;
    })
        .map((doc) => doc._id);
    const publishedDelete = deletePublishedIds.length > 0
        ? await FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.deleteMany({ _id: { $in: deletePublishedIds } })
        : { deletedCount: 0 };
    return {
        deletedNormalized: normalizedDelete.deletedCount ?? 0,
        deletedPublished: publishedDelete.deletedCount ?? 0,
        activeDoeDocument: {
            sourceUrl: String(activeRawDoe?.sourceUrl ?? ""),
            documentDate: new Date(activeRawDoe.aiDocumentDate).toISOString(),
            confidence: typeof activeRawDoe.aiConfidence === "number" ? activeRawDoe.aiConfidence : undefined,
            reason: typeof activeRawDoe.aiReason === "string" ? activeRawDoe.aiReason : undefined,
        },
    };
}
