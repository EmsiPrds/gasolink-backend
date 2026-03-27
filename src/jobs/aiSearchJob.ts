import { searchAndExtractFuelPricesWithAi } from "../services/aiService";
import { NormalizedFuelRecord } from "../models/NormalizedFuelRecord";
import { UpdateLog } from "../models/UpdateLog";
import { buildFingerprint } from "../normalization/fingerprint";
import { validateCandidate } from "../normalization/validators";
import type { FuelType, Region } from "../models/enums";
import { runAiPriceEstimation } from "../reconciliation/aiPriceEstimation";

function isKnownCompanySource(sourceName: string, sourceUrl: string): boolean {
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

type AiSearchOptions = {
  skipReconcile?: boolean;
  degradeToEstimate?: boolean;
  requireEffectivity?: boolean;
  requireRegion?: boolean;
  minReliabilityScore?: number;
};

export async function runAiSearchDataGathering(options?: AiSearchOptions) {
  console.log("==> Starting AI-driven supporting search data gathering...");

  try {
    // Cleanup: remove previously ingested non-market noise records so they don't bias estimates.
    await NormalizedFuelRecord.deleteMany({
      sourceType: "estimate",
      sourceUrl: { $regex: /(typhoon|price-freeze|price%20freeze|bayanihan)/i },
    });

    const aiResult = await searchAndExtractFuelPricesWithAi();

    if (!aiResult || aiResult.items.length === 0) {
      await UpdateLog.create({
        module: "ai_search_job",
        status: "success",
        message: "AI fallback search completed but no supporting fuel data items were found.",
        timestamp: new Date(),
      });
      return { savedCount: 0, scannedCount: 0 };
    }

    const scrapedAt = new Date();
    const seenFingerprints = new Set<string>();
    const operations: Parameters<typeof NormalizedFuelRecord.bulkWrite>[0] = [];
    const minReliabilityScore = options?.minReliabilityScore ?? 0.3;
    let filteredUnreliable = 0;
    let filteredDuplicates = 0;
    const seenLogicalKeys = new Set<string>();

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

      if ((item.reliabilityScore ?? 0) < minReliabilityScore) {
        filteredUnreliable += 1;
        continue;
      }

      const logicalKey = `${item.sourceUrl}::${item.fuelType}::${item.region ?? ""}::${item.effectiveAt ?? ""}`;
      if (seenLogicalKeys.has(logicalKey)) {
        filteredDuplicates += 1;
        continue;
      }
      seenLogicalKeys.add(logicalKey);

      let sourceType: "company_advisory" | "estimate" = "estimate";
      let statusLabel: "Advisory" | "Estimate" = "Estimate";

      if (!options?.degradeToEstimate && isKnownCompanySource(item.sourceName, item.sourceUrl)) {
        sourceType = "company_advisory";
        statusLabel = "Advisory";
      }

      const region = (item.region as Region | undefined) ?? ((options?.requireRegion ?? true) ? undefined : "NCR");
      if (!region) continue;

      const confidenceScore =
        sourceType === "company_advisory"
          ? Math.min(0.65, Math.max(0.25, aiResult.confidence * 0.65))
          : Math.min(0.45, Math.max(0.1, aiResult.confidence * 0.45));

      const candidate = {
        sourceType,
        sourceCategory: "web_scrape",
        statusLabel,
        confidenceScore,
        fuelType: item.fuelType as FuelType,
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

      const validated = validateCandidate(candidate as any);
      const fingerprint = buildFingerprint({
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

      if (seenFingerprints.has(fingerprint)) continue;
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

    const bulkResult =
      operations.length > 0
        ? await NormalizedFuelRecord.bulkWrite(operations, { ordered: false })
        : null;
    const savedCount = bulkResult?.upsertedCount ?? 0;

    await UpdateLog.create({
      module: "ai_search_job",
      status: "success",
      message: `AI data gathering finished. scanned=${aiResult.items.length} created=${savedCount} unreliableFiltered=${filteredUnreliable} duplicateFiltered=${filteredDuplicates}`,
      timestamp: new Date(),
    });

    if (!options?.skipReconcile) {
      console.log("==> Triggering AI-native publish update after AI ingestion...");
      await runAiPriceEstimation();
    }

    return { savedCount, scannedCount: aiResult.items.length };
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error in AI search job:", msg);
    await UpdateLog.create({
      module: "ai_search_job",
      status: "failure",
      message: `AI search job failed: ${msg}`,
      timestamp: new Date(),
    });
    throw error;
  }
}
