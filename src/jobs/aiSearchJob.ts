import { searchAndExtractFuelPricesWithAi } from "../services/aiService";
import { NormalizedFuelRecord } from "../models/NormalizedFuelRecord";
import { UpdateLog } from "../models/UpdateLog";
import { buildFingerprint } from "../normalization/fingerprint";
import { validateCandidate } from "../normalization/validators";
import type { FuelType, Region } from "../models/enums";
import { reconcileFuelRecords } from "../reconciliation/reconcileFuelRecords";

export async function runAiSearchDataGathering() {
  console.log("==> Starting AI-driven search data gathering...");
  
  try {
    const aiResult = await searchAndExtractFuelPricesWithAi();

    if (!aiResult || aiResult.items.length === 0) {
      await UpdateLog.create({
        module: "ai_search_job",
        status: "success",
        message: "AI search completed but no new fuel data items were found.",
        timestamp: new Date(),
      });
      return;
    }

    let savedCount = 0;
    const scrapedAt = new Date();

    for (const item of aiResult.items) {
      // Basic validation: ensure we have at least a price or a change
      if (item.pricePerLiter == null && item.priceChange == null) {
        continue;
      }

      const sourceNameLower = item.sourceName.toLowerCase();
      let sourceType: "official_local" | "company_advisory" | "observed_station" | "estimate" = "official_local";
      let statusLabel: "Verified" | "Official" | "Advisory" | "Observed" | "Estimate" = "Official";

      if (sourceNameLower.includes("doe") || sourceNameLower.includes("energy")) {
        sourceType = "official_local";
        statusLabel = "Official";
      } else if (
        sourceNameLower.includes("petron") ||
        sourceNameLower.includes("shell") ||
        sourceNameLower.includes("caltex") ||
        sourceNameLower.includes("seaoil") ||
        sourceNameLower.includes("unioil") ||
        sourceNameLower.includes("phoenix") ||
        sourceNameLower.includes("cleanfuel")
      ) {
        sourceType = "company_advisory";
        statusLabel = "Advisory";
      } else {
        // Most likely news
        sourceType = "company_advisory"; // News is treated as advisory level for pricing
        statusLabel = "Advisory";
      }

      const candidate = {
        sourceType,
        statusLabel,
        confidenceScore: aiResult.confidence,
        fuelType: item.fuelType as FuelType,
        region: (item.region as Region) || "NCR",
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
        sourceUrl: validated.sourceUrl,
        sourcePublishedAt: validated.sourcePublishedAt ? validated.sourcePublishedAt.toISOString() : "",
        fuelType: validated.fuelType,
        region: validated.region,
        city: validated.city ?? "",
        pricePerLiter: validated.pricePerLiter ?? "",
        priceChange: validated.priceChange ?? "",
        effectiveAt: validated.effectiveAt ? validated.effectiveAt.toISOString() : "",
      });

      const exists = await NormalizedFuelRecord.findOne({ fingerprint });
      if (!exists) {
        await NormalizedFuelRecord.create({
          ...validated,
          fingerprint,
        });
        savedCount++;
      }
    }

    await UpdateLog.create({
      module: "ai_search_job",
      status: "success",
      message: `AI search finished. created ${savedCount} new records.`,
      timestamp: new Date(),
    });

    // Automatically trigger reconciliation after successful data gathering to keep the system updated.
    console.log("==> Triggering automatic reconciliation after AI search...");
    await reconcileFuelRecords();
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error in AI search job:", msg);
    await UpdateLog.create({
      module: "ai_search_job",
      status: "failure",
      message: `AI search job failed: ${msg}`,
      timestamp: new Date(),
    });
  }
}
