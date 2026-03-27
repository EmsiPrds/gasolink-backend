import { FinalPublishedFuelPrice } from "../models/FinalPublishedFuelPrice";
import { NormalizedFuelRecord } from "../models/NormalizedFuelRecord";
import { RawScrapedSource } from "../models/RawScrapedSource";
import { normalizeSourceUrl } from "../utils/doeLatestPolicy";
const MAX_DOE_DOC_AGE_DAYS = 14;

export async function cleanupOutdatedDoeData() {
  const now = new Date();
  const from = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000);

  const activeRawDoe = await RawScrapedSource.findOne({
    sourceType: "official_local",
    aiSelectedLatest: true,
    aiDocumentDate: { $gte: from, $lte: now },
  })
    .sort({ aiDocumentDate: -1, scrapedAt: -1 })
    .select({ sourceUrl: 1, aiDocumentDate: 1, aiConfidence: 1, aiReason: 1 })
    .lean();
  const activeUrl = activeRawDoe?.sourceUrl ? normalizeSourceUrl(String(activeRawDoe.sourceUrl)) : null;

  if (!activeUrl) {
    const oldDelete = await NormalizedFuelRecord.deleteMany({
      sourceType: "official_local",
      $or: [{ effectiveAt: { $lt: from } }, { sourcePublishedAt: { $lt: from } }],
    });
    return { deletedNormalized: oldDelete.deletedCount ?? 0, deletedPublished: 0, activeDoeDocument: null };
  }

  const keepIds = (
    await NormalizedFuelRecord.find({
      sourceType: "official_local",
      $or: [{ effectiveAt: { $gte: from } }, { sourcePublishedAt: { $gte: from } }],
      sourceUrl: { $exists: true },
    })
      .select({ _id: 1, sourceUrl: 1 })
      .limit(5000)
      .lean()
  )
    .filter((record: any) => normalizeSourceUrl(String(record.sourceUrl ?? "")) === activeUrl)
    .map((record: any) => record._id);

  const normalizedDelete = await NormalizedFuelRecord.deleteMany({
    sourceType: "official_local",
    _id: { $nin: keepIds },
  });

  const publishedDocs = await FinalPublishedFuelPrice.find({ finalStatus: "Official" })
    .select({ _id: 1, supportingSources: 1, updatedAt: 1 })
    .limit(2000)
    .lean();
  const deletePublishedIds = publishedDocs
    .filter((doc: any) => {
      if (!doc.updatedAt || doc.updatedAt < from) return true;
      const officialSource = (doc.supportingSources ?? []).find((src: any) => src.sourceType === "official_local");
      if (!officialSource?.sourceUrl) return true;
      return normalizeSourceUrl(String(officialSource.sourceUrl)) !== activeUrl;
    })
    .map((doc: any) => doc._id);

  const publishedDelete =
    deletePublishedIds.length > 0
      ? await FinalPublishedFuelPrice.deleteMany({ _id: { $in: deletePublishedIds } })
      : { deletedCount: 0 };

  return {
    deletedNormalized: normalizedDelete.deletedCount ?? 0,
    deletedPublished: publishedDelete.deletedCount ?? 0,
    activeDoeDocument: {
      sourceUrl: String(activeRawDoe?.sourceUrl ?? ""),
      documentDate: new Date((activeRawDoe as any).aiDocumentDate).toISOString(),
      confidence: typeof (activeRawDoe as any).aiConfidence === "number" ? (activeRawDoe as any).aiConfidence : undefined,
      reason: typeof (activeRawDoe as any).aiReason === "string" ? (activeRawDoe as any).aiReason : undefined,
    },
  };
}
