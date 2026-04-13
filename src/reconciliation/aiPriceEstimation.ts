import { NormalizedFuelRecord } from "../models/NormalizedFuelRecord";
import { FinalPublishedFuelPrice } from "../models/FinalPublishedFuelPrice";
import { FuelPricePH } from "../models/FuelPricePH";
import { FuelTypeValues, RegionValues } from "../models/enums";
import { UpdateLog } from "../models/UpdateLog";
import { env } from "../config/env";
import { normalizeSourceUrl, resolveDoeDocumentDate } from "../utils/doeLatestPolicy";
import { RawScrapedSource } from "../models/RawScrapedSource";
const MAX_DOE_DOC_AGE_DAYS = 14;

type SourceCategory = "global_api" | "doe_official" | "web_scrape" | "user_report";
type Candidate = {
  _id: unknown;
  sourceType: string;
  sourceCategory?: SourceCategory;
  sourceName: string;
  sourceUrl: string;
  statusLabel: string;
  confidenceScore: number;
  pricePerLiter?: number;
  priceChange?: number;
  sourcePublishedAt?: Date;
  scrapedAt: Date;
  effectiveAt?: Date;
};

function defaultBaselinePrice(fuelType: string): number {
  if (fuelType === "Gasoline") return 65;
  if (fuelType === "Diesel") return 60;
  return 75; // Kerosene
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function quantile(values: number[], q: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function confidenceLabel(score: number): "Low" | "Medium" | "High" | "Very High" {
  if (score >= 0.9) return "Very High";
  if (score >= 0.75) return "High";
  if (score >= 0.55) return "Medium";
  return "Low";
}

function sourceWeight(category: SourceCategory): number {
  if (category === "doe_official") return 0.45;
  if (category === "global_api") return 0.2;
  if (category === "web_scrape") return 0.22;
  return 0.13;
}

function candidateTimestamp(candidate: Candidate): Date {
  return candidate.effectiveAt ?? candidate.sourcePublishedAt ?? candidate.scrapedAt;
}

function isWithinRange(candidate: Candidate): boolean {
  if (typeof candidate.pricePerLiter === "number") return candidate.pricePerLiter >= 30 && candidate.pricePerLiter <= 120;
  if (typeof candidate.priceChange === "number") return candidate.priceChange >= -15 && candidate.priceChange <= 15;
  return false;
}

export function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  if (q1 == null || q3 == null) return values;
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return values.filter((value) => value >= lower && value <= upper);
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function computeFreshnessHours(candidates: Candidate[], now: Date): number | null {
  if (!candidates.length) return null;
  const latestTs = Math.max(...candidates.map((candidate) => candidateTimestamp(candidate).getTime()));
  return Math.max(0, (now.getTime() - latestTs) / (1000 * 60 * 60));
}

export async function runAiPriceEstimation() {
  if (env.ENABLE_NEW_ESTIMATOR === "false") return { estimations: 0, skipped: true };

  const now = new Date();
  const from = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000);
  const activeRawDoe = await RawScrapedSource.findOne({
    sourceType: "official_local",
    aiSelectedLatest: true,
    aiDocumentDate: { $gte: from, $lte: now },
  })
    .sort({ aiDocumentDate: -1, scrapedAt: -1 })
    .select({ sourceUrl: 1 })
    .lean();
  const activeDoeUrl = activeRawDoe?.sourceUrl ? normalizeSourceUrl(String(activeRawDoe.sourceUrl)) : null;

  let estimations = 0;

  for (const region of RegionValues) {
    for (const fuelType of FuelTypeValues) {
      if (!activeDoeUrl) {
        await UpdateLog.create({
          module: "ai_estimation",
          status: "failure",
          message: `DOE freshness guard blocked: no active DOE doc within ${MAX_DOE_DOC_AGE_DAYS} days for ${fuelType}/${region}.`,
          timestamp: now,
        }).catch(() => {});
        continue;
      }

      const candidates = (await NormalizedFuelRecord.find({
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
        .lean()) as unknown as Candidate[];

      const validCandidates = candidates.filter(isWithinRange);
      const latestDocCandidates = validCandidates.filter((candidate) => {
        const docDate = resolveDoeDocumentDate(candidate.sourceUrl, candidate.effectiveAt ?? candidate.sourcePublishedAt);
        if (!docDate || docDate < from) return false;
        return normalizeSourceUrl(candidate.sourceUrl) === activeDoeUrl;
      });

      const baseline = await FuelPricePH.findOne({ fuelType, region }).sort({ updatedAt: -1 }).lean();
      const baselinePrice =
        typeof baseline?.price === "number" && Number.isFinite(baseline.price) ? baseline.price : defaultBaselinePrice(fuelType);

      if (!latestDocCandidates.length) {
        const publishKey = `fused_est::${fuelType}::${region}`;
        await FinalPublishedFuelPrice.findOneAndUpdate(
          { publishKey },
          {
            displayType: "ph_final",
            fuelType,
            region,
            finalPrice: baselinePrice,
            averagePrice: baselinePrice,
            priceChange: 0,
            finalStatus: "Estimate",
            confidenceScore: 0.35,
            confidenceLabel: confidenceLabel(0.35),
            estimateExplanation: `Fallback baseline used: latest DOE rows for ${fuelType}/${region} were unavailable or invalid.`,
            sourceBreakdown: [],
            lastVerifiedAt: now,
            updatedAt: now,
            publishKey,
            supportingSources: [],
          },
          { upsert: true },
        );
        estimations++;
        continue;
      }

      const withDerivedPrice = latestDocCandidates
        .map((candidate) => {
          const derived = typeof candidate.pricePerLiter === "number" ? candidate.pricePerLiter : baselinePrice + (candidate.priceChange ?? 0);
          return { ...candidate, derivedPrice: derived, sourceCategory: "doe_official" as const };
        })
        .filter((candidate) => Number.isFinite(candidate.derivedPrice));

      const cleanedPrices = removeOutliers(withDerivedPrice.map((candidate) => candidate.derivedPrice));
      const cleanedSet = new Set(cleanedPrices.map((price) => price.toFixed(4)));
      const cleanedCandidates = withDerivedPrice.filter((candidate) => cleanedSet.has(candidate.derivedPrice.toFixed(4)));
      if (!cleanedCandidates.length) {
        const publishKey = `fused_est::${fuelType}::${region}`;
        await FinalPublishedFuelPrice.findOneAndUpdate(
          { publishKey },
          {
            displayType: "ph_final",
            fuelType,
            region,
            finalPrice: baselinePrice,
            averagePrice: baselinePrice,
            priceChange: 0,
            finalStatus: "Estimate",
            confidenceScore: 0.35,
            confidenceLabel: confidenceLabel(0.35),
            estimateExplanation: `Fallback baseline used: ${fuelType}/${region} candidates were filtered out as outliers.`,
            sourceBreakdown: [],
            lastVerifiedAt: now,
            updatedAt: now,
            publishKey,
            supportingSources: [],
          },
          { upsert: true },
        );
        estimations++;
        continue;
      }

      const weighted = cleanedCandidates.reduce(
        (acc, candidate) => {
          const recencyHours = (now.getTime() - candidateTimestamp(candidate).getTime()) / (1000 * 60 * 60);
          const recencyFactor = clamp(1 - recencyHours / (24 * 10), 0.2, 1);
          const weight = sourceWeight(candidate.sourceCategory) * clamp(candidate.confidenceScore, 0.1, 1) * recencyFactor;
          return {
            weightedSum: acc.weightedSum + candidate.derivedPrice * weight,
            totalWeight: acc.totalWeight + weight,
          };
        },
        { weightedSum: 0, totalWeight: 0 },
      );

      let deterministicEstimate =
        weighted.totalWeight > 0 ? weighted.weightedSum / weighted.totalWeight : median(cleanedCandidates.map((candidate) => candidate.derivedPrice));
      if (deterministicEstimate == null || !Number.isFinite(deterministicEstimate)) deterministicEstimate = baselinePrice;

      // DOE-only mode: no global/web/user adjustments.

      const explanation = `Based on latest DOE document within ${MAX_DOE_DOC_AGE_DAYS} days (${cleanedCandidates.length} records).`;
      const finalEstimate = deterministicEstimate;
      const aiConfidenceBoost = 0;

      const byCategory = new Map<SourceCategory, Array<typeof cleanedCandidates[number]>>();
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
      // Dashboard filters out low-confidence rows; keep DOE-official publish rows visible once validated.
      const finalConfidence = clamp(
        0.35 * avgSourceConfidence + 0.25 * agreementScore + 0.25 * freshnessScore + 0.15 * sampleScore + aiConfidenceBoost,
        0.35,
        0.98,
      );

      const supportingCandidates = cleanedCandidates.slice(0, 8);
      const publishKey = `fused_est::${fuelType}::${region}`;

      await FinalPublishedFuelPrice.findOneAndUpdate(
        { publishKey },
        {
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
            normalizedRecordId: candidate._id as any,
            sourceType: candidate.sourceType as any,
            sourceName: candidate.sourceName,
            sourceUrl: candidate.sourceUrl,
            sourcePublishedAt: candidate.sourcePublishedAt,
            scrapedAt: candidate.scrapedAt,
            parserVersion: "fused_v1",
            confidenceScore: candidate.confidenceScore,
            statusLabel: candidate.statusLabel as any,
          })),
        },
        { upsert: true },
      );

      estimations++;
    }
  }

  await UpdateLog.create({
    module: "ai_estimation",
    status: "success",
    message: `Fusion estimation finished. created/updated ${estimations} estimates.`,
    timestamp: now,
  });

  return { estimations };
}
