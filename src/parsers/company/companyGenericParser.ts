import * as cheerio from "cheerio";
import type { SourceParser } from "../parserTypes";
import { confidenceForSourceType, statusLabelForSourceType } from "../../normalization/confidence";
import { extractEffectivity, extractFuelDeltas } from "../shared/deltaExtract";
import type { NormalizedCandidate } from "../parserTypes";
import type { Region } from "../../models/enums";

const regions: Region[] = ["NCR", "Luzon", "Visayas", "Mindanao"];

function inferCompanyName(sourceName: string, sourceUrl: string): string | undefined {
  const combined = `${sourceName} ${sourceUrl}`.toLowerCase();
  const mappings: Array<[string, string]> = [
    ["petron", "Petron"],
    ["shell", "Shell"],
    ["caltex", "Caltex"],
    ["seaoil", "SeaOil"],
    ["unioil", "Unioil"],
    ["phoenix", "Phoenix"],
    ["cleanfuel", "Cleanfuel"],
    ["jetti", "Jetti"],
    ["ptt", "PTT"],
    ["total", "TotalEnergies"],
  ];

  return mappings.find(([keyword]) => combined.includes(keyword))?.[1];
}

export const companyGenericParser: SourceParser = {
  id: "company_generic_v1",
  canHandle: (raw) => raw.parserId === "company_generic_v1",
  parse: async (raw) => {
    const html = raw.rawHtml ?? "";
    const text = raw.rawText ?? "";
    const combined = html ? cheerio.load(html).text() : text;

    const deltas = extractFuelDeltas(combined);
    const effectiveAt = extractEffectivity(combined);

    // Fail closed: require both a delta and effectivity so old advisories do not get resurfaced.
    if (deltas.length === 0 || !effectiveAt) return { ok: true, items: [] };

    const sourceType = raw.sourceType;
    const statusLabel = statusLabelForSourceType(sourceType);
    const confidenceScore = confidenceForSourceType(sourceType);
    const scrapedAt = raw.scrapedAt ?? new Date();
    const companyName = inferCompanyName(raw.sourceName, raw.sourceUrl);

    const items: NormalizedCandidate[] = [];
    for (const r of regions) {
      for (const d of deltas) {
        items.push({
          sourceType,
          statusLabel,
          confidenceScore,
          fuelType: d.fuelType,
          region: r,
          companyName,
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
