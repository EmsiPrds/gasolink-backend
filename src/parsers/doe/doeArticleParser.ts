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

function isProbablyDoePdfUrl(url: string): boolean {
  return url.includes("/sites/default/files/pdf/");
}

export const doeArticleParser: SourceParser = {
  id: "doe_article_v1",
  canHandle: (raw) => raw.parserId === "doe_article_v1",
  parse: async (raw) => {
    const html = raw.rawHtml ?? "";
    if (!html) return { ok: false, error: "No HTML to parse" };

    const $ = cheerio.load(html);
    const pdfLinks = new Set<string>();

    $("a[href]").each((_, el) => {
      const href = String($(el).attr("href") ?? "").trim();
      if (!href) return;
      const abs = absolutize(raw.sourceUrl, href);
      if (isProbablyDoePdfUrl(abs)) pdfLinks.add(abs);
    });

    const now = new Date();
    for (const url of Array.from(pdfLinks)) {
      await RawScrapedSource.create({
        sourceType: raw.sourceType,
        sourceName: raw.sourceName,
        sourceUrl: url,
        parserId: "doe_pdf_v1",
        scrapedAt: now,
        parserVersion: raw.parserVersion,
        processingStatus: "raw",
      });
    }

    return { ok: true, items: [] };
  },
};

