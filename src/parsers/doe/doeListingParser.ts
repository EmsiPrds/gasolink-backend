import * as cheerio from "cheerio";
import type { SourceParser } from "../parserTypes";
import { RawScrapedSource } from "../../models/RawScrapedSource";

function absolutize(baseUrl: string, href: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function isProbablyDoeArticleUrl(url: string): boolean {
  return url.startsWith("https://doe.gov.ph/articles/");
}

function isProbablyDoePdfUrl(url: string): boolean {
  return url.includes("/sites/default/files/pdf/");
}

export const doeListingParser: SourceParser = {
  id: "doe_listing_v1",
  canHandle: (raw) => raw.parserId === "doe_listing_v1",
  parse: async (raw) => {
    const html = raw.rawHtml ?? "";
    if (!html) return { ok: false, error: "No HTML to parse" };

    const $ = cheerio.load(html);
    const links = new Set<string>();

    $("a[href]").each((_, el) => {
      const href = String($(el).attr("href") ?? "").trim();
      if (!href) return;
      const abs = absolutize(raw.sourceUrl, href);
      if (isProbablyDoeArticleUrl(abs) || isProbablyDoePdfUrl(abs)) links.add(abs);
    });

    // Side-effect: enqueue discovered articles/pdfs as raw snapshots for later parsing.
    // We do not emit normalized records here because listings usually require following the link.
    const discovered = Array.from(links);
    const now = new Date();

    for (const url of discovered) {
      await RawScrapedSource.create({
        sourceType: raw.sourceType,
        sourceName: raw.sourceName,
        sourceUrl: url,
        parserId: isProbablyDoePdfUrl(url) ? "doe_pdf_v1" : "doe_article_v1",
        scrapedAt: now,
        parserVersion: raw.parserVersion,
        processingStatus: "raw",
      });
    }

    return { ok: true, items: [] };
  },
};

