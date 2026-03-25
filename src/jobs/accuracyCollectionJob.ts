import { FinalPublishedFuelPrice } from "../models/FinalPublishedFuelPrice";
import { NormalizedFuelRecord } from "../models/NormalizedFuelRecord";
import { drainPendingRawSources } from "../pipeline/normalizeRawSources";
import { runConfiguredSourceCollection } from "../services/sourceCollectionService";
import { runAiSearchDataGathering } from "./aiSearchJob";

type CollectionSummary = Awaited<ReturnType<typeof runConfiguredSourceCollection>>;
type NormalizationSummary = Awaited<ReturnType<typeof drainPendingRawSources>>;
type AiFallbackSummary = Awaited<ReturnType<typeof runAiSearchDataGathering>>;

function combineNormalizationSummaries(a: NormalizationSummary, b: NormalizationSummary): NormalizationSummary {
  return {
    passes: a.passes + b.passes,
    processed: a.processed + b.processed,
    normalized: a.normalized + b.normalized,
    failed: a.failed + b.failed,
  };
}

export async function runAccuracyFirstCollection() {
  const officialCollection = await runConfiguredSourceCollection({ scope: "official" });
  let normalization = await drainPendingRawSources({ limitPerPass: 150, maxPasses: 6 });

  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const freshOfficialNormalized = await NormalizedFuelRecord.countDocuments({
    sourceType: "official_local",
    updatedAt: { $gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) },
  });

  const latestOfficialHeadline = await FinalPublishedFuelPrice.findOne({
    displayType: "ph_final",
    companyName: { $in: [null, ""] },
    city: { $in: [null, ""] },
  })
    .sort({ lastVerifiedAt: -1 })
    .select({ lastVerifiedAt: 1 })
    .lean();

  let aiFallback: (AiFallbackSummary & { ran: boolean; reason?: string }) | { ran: false; reason?: string } = {
    ran: false,
  };

  const shouldRunAiFallback =
    freshOfficialNormalized === 0 &&
    (
      !latestOfficialHeadline ||
      !latestOfficialHeadline.lastVerifiedAt ||
      new Date(latestOfficialHeadline.lastVerifiedAt).getTime() < fiveDaysAgo.getTime()
    );

  if (shouldRunAiFallback) {
    aiFallback = {
      ...(await runAiSearchDataGathering({
        skipReconcile: true,
        degradeToEstimate: true,
        requireEffectivity: true,
        requireRegion: true,
      })),
      ran: true,
      reason: "No fresh official headline price was available, so AI fallback gathered supporting estimate-only records.",
    };

    const fallbackNormalization = await drainPendingRawSources({ limitPerPass: 100, maxPasses: 3 });
    normalization = combineNormalizationSummaries(normalization, fallbackNormalization);
  }

  return {
    officialCollection: officialCollection as CollectionSummary,
    normalization,
    aiFallback,
  };
}
