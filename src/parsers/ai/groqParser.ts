import * as cheerio from "cheerio";
import type { SourceParser, NormalizedCandidate } from "../parserTypes";
import { extractFuelDataWithAi } from "../../services/aiService";
import { confidenceForSourceType, statusLabelForSourceType } from "../../normalization/confidence";
import type { FuelType, Region } from "../../models/enums";

export const groqParser: SourceParser = {
  id: "ai_groq_v1",
  canHandle: (raw) => raw.parserId === "ai_groq_v1",
  parse: async (raw) => {
    const html = raw.rawHtml ?? "";
    const text = raw.rawText ?? "";
    
    // For HTML, we prefer the plain text content for AI analysis.
    const combined = html ? cheerio.load(html).text() : text;
    
    if (!combined.trim()) {
      return { ok: false, error: "No text content available for AI parsing." };
    }

    // Call the AI service to extract structured data.
    const aiResult = await extractFuelDataWithAi(combined);
    
    if (!aiResult || aiResult.items.length === 0) {
      return { ok: true, items: [] };
    }

    const sourceType = raw.sourceType;
    const statusLabel = statusLabelForSourceType(sourceType);
    const confidenceScore = confidenceForSourceType(sourceType) * aiResult.confidence;
    const scrapedAt = raw.scrapedAt ?? new Date();

    const items: NormalizedCandidate[] = aiResult.items.map((item) => ({
      sourceType,
      statusLabel,
      confidenceScore,
      fuelType: item.fuelType as FuelType,
      region: (item.region as Region) || "NCR", // default to NCR if not found
      city: item.city,
      pricePerLiter: item.pricePerLiter,
      priceChange: item.priceChange,
      currency: "PHP",
      sourceName: raw.sourceName,
      sourceUrl: raw.sourceUrl,
      scrapedAt,
      effectiveAt: item.effectiveAt ? new Date(item.effectiveAt) : undefined,
      sourcePublishedAt: item.effectiveAt ? new Date(item.effectiveAt) : undefined,
      companyName: item.companyName,
      productName: item.productName,
    }));

    return { ok: true, items };
  },
};
