import * as cheerio from "cheerio";
import type { SourceParser } from "../parserTypes";
import { RawScrapedSource } from "../../models/RawScrapedSource";
import { discoverLatestLinksWithAi } from "../../services/aiService";
import { inferDoeDocumentDateFromLabel, inferDoeDocumentDateFromUrl } from "./dateInference";
import { DOE_PDF_PARSER_ID } from "./constants";
import { validateLatestDoeDocWithAi } from "../../services/doeFreshnessAiService";
const MAX_DOE_DOC_AGE_DAYS = 14;

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

type DiscoveredDoeLink = {
  url: string;
  publishedAt: Date | null;
};

function buildRecentCutoff(now: Date): Date {
  return new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);
}

function discoverDoeLinksFromStructuredTable(html: string, baseUrl: string): DiscoveredDoeLink[] {
  const $ = cheerio.load(html);
  const discovered = new Map<string, Date | null>();

  $("tr").each((_, row) => {
    const yearText = $(row).find("h2").first().text().trim();
    const fallbackYear = Number(yearText);
    const year = Number.isFinite(fallbackYear) && fallbackYear >= 2000 ? fallbackYear : null;

    $(row)
      .find("a[href]")
      .each((__, anchor) => {
        const href = String($(anchor).attr("href") ?? "").trim();
        if (!href) return;
        const abs = absolutize(baseUrl, href);
        if (!isProbablyDoePdfUrl(abs)) return;

        const label = $(anchor).text().replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
        const publishedAt = inferDoeDocumentDateFromLabel(label, year) ?? inferDoeDocumentDateFromUrl(abs);
        discovered.set(abs, publishedAt);
      });
  });

  return Array.from(discovered.entries()).map(([url, publishedAt]) => ({ url, publishedAt }));
}

function discoverDoeLinksFallback(html: string, baseUrl: string): DiscoveredDoeLink[] {
  const $ = cheerio.load(html);
  const discovered = new Map<string, Date | null>();

  $("a[href]").each((_, el) => {
    const href = String($(el).attr("href") ?? "").trim();
    if (!href) return;
    const abs = absolutize(baseUrl, href);
    if (!isProbablyDoePdfUrl(abs)) return;

    const label = $(el).text().replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
    const publishedAt = inferDoeDocumentDateFromLabel(label, null) ?? inferDoeDocumentDateFromUrl(abs);
    discovered.set(abs, publishedAt);
  });

  const pdfMatches = html.matchAll(/(https?:\/\/[^"'\s>]+(?:\.pdf|\/documents\/d\/guest\/[^"'\s>]+))/gi);
  for (const match of pdfMatches) {
    const abs = absolutize(baseUrl, String(match[1]));
    if (!isProbablyDoePdfUrl(abs)) continue;
    const publishedAt = inferDoeDocumentDateFromUrl(abs);
    discovered.set(abs, publishedAt);
  }

  return Array.from(discovered.entries()).map(([url, publishedAt]) => ({ url, publishedAt }));
}

export const doeListingParser: SourceParser = {
  id: "doe_listing_v1",
  canHandle: (raw) => raw.parserId === "doe_listing_v1",
  parse: async (raw) => {
    const html = raw.rawHtml ?? "";
    if (!html) return { ok: false, error: "No HTML to parse" };

    let discovered = discoverDoeLinksFromStructuredTable(html, raw.sourceUrl);
    if (discovered.length === 0) {
      discovered = discoverDoeLinksFallback(html, raw.sourceUrl);
    }

    // Only ask AI for help if deterministic discovery found nothing.
    if (discovered.length === 0) {
      const aiResult = await discoverLatestLinksWithAi(raw.sourceUrl, html);
      if (aiResult && aiResult.links.length > 0) {
        for (const link of aiResult.links) {
          if (!link.isLatest) continue;
          const url = absolutize(raw.sourceUrl, link.url);
          discovered.push({
            url,
            publishedAt: inferDoeDocumentDateFromUrl(url),
          });
        }
      }
    }

    if (discovered.length === 0) {
      return { ok: true, items: [] };
    }

    const now = new Date();
    const recentCutoff = buildRecentCutoff(now);
    const recentDocs = discovered
      .filter((doc) => !doc.publishedAt || doc.publishedAt >= recentCutoff)
      .sort((a, b) => {
        const at = a.publishedAt ? a.publishedAt.getTime() : 0;
        const bt = b.publishedAt ? b.publishedAt.getTime() : 0;
        return bt - at;
      })
      .slice(0, 16);

    // OpenAI freshness guard: choose SINGLE newest document and verify it's within the allowed weekly window.
    const ai = await validateLatestDoeDocWithAi({
      now,
      listingUrl: raw.sourceUrl,
      listingHtmlSnippet: html.slice(0, 12000),
      candidates: recentDocs.map((d) => ({
        url: d.url,
        label: d.url,
        publishedAtHint: d.publishedAt ? d.publishedAt.toISOString() : null,
      })),
    });

    const aiDocDate = new Date(ai.documentDate);
    const cutoff = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000);
    const docWithinAllowedWindow =
      Number.isFinite(aiDocDate.getTime()) && aiConfidencePass(ai.confidence) && aiDocDate >= cutoff && aiDocDate <= now;

    if (!docWithinAllowedWindow) {
      // Fail-closed: do not upsert any DOE PDF raws if freshness cannot be verified.
      await RawScrapedSource.updateOne(
        { sourceUrl: raw.sourceUrl, parserId: raw.parserId },
        {
          $set: {
            errorMessage: `DOE freshness guard blocked: ${ai.reason}`,
          },
        },
      ).catch(() => {});
      return { ok: true, items: [] };
    }

    await RawScrapedSource.updateOne(
      { sourceUrl: ai.latestDocUrl, parserId: DOE_PDF_PARSER_ID },
      {
        $set: {
          sourcePublishedAt: aiDocDate,
          aiSelectedLatest: true,
          aiDocumentDate: aiDocDate,
          aiConfidence: ai.confidence,
          aiReason: ai.reason,
        },
        $setOnInsert: {
          sourceType: raw.sourceType,
          sourceName: raw.sourceName,
          sourceUrl: ai.latestDocUrl,
          parserId: DOE_PDF_PARSER_ID,
          scrapedAt: now,
          parserVersion: raw.parserVersion,
          processingStatus: "raw",
        },
      },
      { upsert: true },
    );

    return { ok: true, items: [] };
  },
};

function aiConfidencePass(confidence: number): boolean {
  return typeof confidence === "number" && confidence >= 0.65;
}
