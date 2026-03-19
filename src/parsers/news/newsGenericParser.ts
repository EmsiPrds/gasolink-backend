import * as cheerio from "cheerio";
import type { SourceParser } from "../parserTypes";
import { confidenceForSourceType, statusLabelForSourceType } from "../../normalization/confidence";
import { extractEffectivity, extractFuelDeltas } from "../shared/deltaExtract";
import type { NormalizedCandidate } from "../parserTypes";
import type { Region } from "../../models/enums";

const regions: Region[] = ["NCR", "Luzon", "Visayas", "Mindanao"];

export const newsGenericParser: SourceParser = {
  id: "news_generic_v1",
  canHandle: (raw) => raw.parserId === "news_generic_v1",
  parse: async (raw) => {
    const html = raw.rawHtml ?? "";
    const text = raw.rawText ?? "";
    const combined = html ? cheerio.load(html).text() : text;

    const deltas = extractFuelDeltas(combined);
    const effectiveAt = extractEffectivity(combined);

    // News often mentions deltas without exact timing; fail closed if timing is missing.
    if (deltas.length === 0 || !effectiveAt) return { ok: true, items: [] };

    const sourceType = raw.sourceType; // company_advisory (corroboration)
    const statusLabel = statusLabelForSourceType(sourceType);
    const confidenceScore = confidenceForSourceType(sourceType);
    const scrapedAt = raw.scrapedAt ?? new Date();

    const items: NormalizedCandidate[] = [];
    for (const r of regions) {
      for (const d of deltas) {
        items.push({
          sourceType,
          statusLabel,
          confidenceScore,
          fuelType: d.fuelType,
          region: r,
          priceChange: d.delta,
          currency: "PHP",
          sourceName: raw.sourceName,
          sourceUrl: raw.sourceUrl,
          scrapedAt,
          effectiveAt,
          sourcePublishedAt: effectiveAt,
        });
      }
    }

    return { ok: true, items };
  },
};

