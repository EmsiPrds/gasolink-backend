import * as cheerio from "cheerio";
import type { SourceParser } from "../parserTypes";
import { RawScrapedSource } from "../../models/RawScrapedSource";
import { discoverLatestLinksWithAi } from "../../services/aiService";

function absolutize(baseUrl: string, href: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function isProbablyDoePdfUrl(url: string): boolean {
  return (
    url.includes("/sites/default/files/pdf/") ||
    url.includes("prod-cms.doe.gov.ph/documents") ||
    url.toLowerCase().endsWith(".pdf")
  );
}

function extractDateFromDoeUrl(url: string): number {
  // Examples we might see in hrefs:
  // - .../2026-03-19...pdf
  // - .../2026_03_19...pdf
  // - .../20260319...pdf
  const m1 = url.match(/(20\d{2})[-_\/](\d{2})[-_\/](\d{2})/);
  if (m1) {
    const d = Date.parse(`${m1[1]}-${m1[2]}-${m1[3]}T00:00:00Z`);
    return Number.isFinite(d) ? d : 0;
  }

  const m2 = url.match(/(20\d{2})(\d{2})(\d{2})/);
  if (m2) {
    const d = Date.parse(`${m2[1]}-${m2[2]}-${m2[3]}T00:00:00Z`);
    return Number.isFinite(d) ? d : 0;
  }

  return 0;
}

export const doeListingParser: SourceParser = {
  id: "doe_listing_v1",
  canHandle: (raw) => raw.parserId === "doe_listing_v1",
  parse: async (raw) => {
    const html = raw.rawHtml ?? "";
    if (!html) return { ok: false, error: "No HTML to parse" };

    // Use AI to find the LATEST links on the page.
    const aiResult = await discoverLatestLinksWithAi(raw.sourceUrl, html);
    const discovered = new Set<string>();

    if (aiResult && aiResult.links.length > 0) {
      for (const link of aiResult.links) {
        if (link.isLatest) discovered.add(absolutize(raw.sourceUrl, link.url));
      }
    } else {
      // Fallback to regex discovery if AI fails or returns nothing.
      const $ = cheerio.load(html);
      $("a[href]").each((_, el) => {
        const href = String($(el).attr("href") ?? "").trim();
        if (!href) return;
        const abs = absolutize(raw.sourceUrl, href);
        if (isProbablyDoePdfUrl(abs)) discovered.add(abs);
      });

      const pdfMatches = html.matchAll(/(https?:\/\/[^"'\s>]+\.pdf)/gi);
      for (const match of pdfMatches) {
        discovered.add(String(match[1]));
      }
    }

    if (discovered.size === 0) {
      return { ok: true, items: [] };
    }

    const now = new Date();

    // Enqueue all discovered PDF links, but avoid duplicates.
    for (const url of discovered) {
      const abs = url; // already absolute
      
      // RECENCY CHECK: Ignore links that are clearly old based on the URL.
      const dateMs = extractDateFromDoeUrl(abs);
      if (dateMs > 0) {
        const date = new Date(dateMs);
        if (date.getUTCFullYear() < 2025) continue;
      }

      // Upsert to avoid duplicate work; keep first seen record.
      await RawScrapedSource.updateOne(
        { sourceUrl: abs, parserId: "doe_pdf_v1" },
        {
          $setOnInsert: {
            sourceType: raw.sourceType,
            sourceName: raw.sourceName,
            sourceUrl: abs,
            parserId: "doe_pdf_v1",
            scrapedAt: now,
            parserVersion: raw.parserVersion,
            processingStatus: "raw",
          },
        },
        { upsert: true },
      );
    }

    return { ok: true, items: [] };
  },
};

