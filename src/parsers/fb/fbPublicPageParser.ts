import * as cheerio from "cheerio";
import type { SourceParser } from "../parserTypes";
import { confidenceForSourceType, statusLabelForSourceType } from "../../normalization/confidence";
import { extractEffectivity, extractFuelDeltas } from "../shared/deltaExtract";
import type { NormalizedCandidate } from "../parserTypes";
import type { Region } from "../../models/enums";

const regions: Region[] = ["NCR", "Luzon", "Visayas", "Mindanao"];

function extractOutboundLinks($: cheerio.CheerioAPI): string[] {
  const links = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = String($(el).attr("href") ?? "");
    if (!href) return;
    if (!href.startsWith("http")) return;
    // Keep non-Facebook links for provenance (official advisories often link out)
    if (href.includes("facebook.com")) return;
    links.add(href);
  });
  return Array.from(links).slice(0, 10);
}

export const fbPublicPageParser: SourceParser = {
  id: "fb_public_page_v1",
  canHandle: (raw) => raw.parserId === "fb_public_page_v1",
  parse: async (raw) => {
    const html = raw.rawHtml ?? "";
    if (!html) return { ok: false, error: "No HTML to parse" };

    const $ = cheerio.load(html);
    const pageText = $.text();

    // Fail closed: require BOTH deltas and an effectivity date to reduce false positives.
    const deltas = extractFuelDeltas(pageText);
    const effectiveAt = extractEffectivity(pageText);
    if (deltas.length === 0 || !effectiveAt) return { ok: true, items: [] };

    const outboundLinks = extractOutboundLinks($);

    const sourceType = raw.sourceType;
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
          // Preserve the FB page as primary sourceUrl; outbound links can be viewed via transparency on raw snapshot.
          sourceUrl: raw.sourceUrl,
          scrapedAt,
          effectiveAt,
          sourcePublishedAt: effectiveAt,
        });
      }
    }

    // Attach outbound links as rawText augmentation for admin review (still not user-facing).
    if (outboundLinks.length > 0) {
      // note: we don't mutate raw here; normalization runner can save rawText if needed later.
    }

    return { ok: true, items };
  },
};

