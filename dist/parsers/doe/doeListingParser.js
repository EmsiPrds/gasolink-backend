"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.doeListingParser = void 0;
const cheerio = __importStar(require("cheerio"));
const RawScrapedSource_1 = require("../../models/RawScrapedSource");
const aiService_1 = require("../../services/aiService");
const dateInference_1 = require("./dateInference");
const constants_1 = require("./constants");
const doeFreshnessAiService_1 = require("../../services/doeFreshnessAiService");
const MAX_DOE_DOC_AGE_DAYS = 14;
function absolutize(baseUrl, href) {
    try {
        return new URL(href, baseUrl).toString();
    }
    catch {
        return href;
    }
}
function isProbablyDoePdfUrl(url) {
    return (url.includes("/sites/default/files/pdf/") ||
        url.includes("prod-cms.doe.gov.ph/documents") ||
        url.toLowerCase().endsWith(".pdf"));
}
function buildRecentCutoff(now) {
    return new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);
}
function discoverDoeLinksFromStructuredTable(html, baseUrl) {
    const $ = cheerio.load(html);
    const discovered = new Map();
    $("tr").each((_, row) => {
        const yearText = $(row).find("h2").first().text().trim();
        const fallbackYear = Number(yearText);
        const year = Number.isFinite(fallbackYear) && fallbackYear >= 2000 ? fallbackYear : null;
        $(row)
            .find("a[href]")
            .each((__, anchor) => {
            const href = String($(anchor).attr("href") ?? "").trim();
            if (!href)
                return;
            const abs = absolutize(baseUrl, href);
            if (!isProbablyDoePdfUrl(abs))
                return;
            const label = $(anchor).text().replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
            const publishedAt = (0, dateInference_1.inferDoeDocumentDateFromLabel)(label, year) ?? (0, dateInference_1.inferDoeDocumentDateFromUrl)(abs);
            discovered.set(abs, publishedAt);
        });
    });
    return Array.from(discovered.entries()).map(([url, publishedAt]) => ({ url, publishedAt }));
}
function discoverDoeLinksFallback(html, baseUrl) {
    const $ = cheerio.load(html);
    const discovered = new Map();
    $("a[href]").each((_, el) => {
        const href = String($(el).attr("href") ?? "").trim();
        if (!href)
            return;
        const abs = absolutize(baseUrl, href);
        if (!isProbablyDoePdfUrl(abs))
            return;
        const label = $(el).text().replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
        const publishedAt = (0, dateInference_1.inferDoeDocumentDateFromLabel)(label, null) ?? (0, dateInference_1.inferDoeDocumentDateFromUrl)(abs);
        discovered.set(abs, publishedAt);
    });
    const pdfMatches = html.matchAll(/(https?:\/\/[^"'\s>]+(?:\.pdf|\/documents\/d\/guest\/[^"'\s>]+))/gi);
    for (const match of pdfMatches) {
        const abs = absolutize(baseUrl, String(match[1]));
        if (!isProbablyDoePdfUrl(abs))
            continue;
        const publishedAt = (0, dateInference_1.inferDoeDocumentDateFromUrl)(abs);
        discovered.set(abs, publishedAt);
    }
    return Array.from(discovered.entries()).map(([url, publishedAt]) => ({ url, publishedAt }));
}
exports.doeListingParser = {
    id: "doe_listing_v1",
    canHandle: (raw) => raw.parserId === "doe_listing_v1",
    parse: async (raw) => {
        const html = raw.rawHtml ?? "";
        if (!html)
            return { ok: false, error: "No HTML to parse" };
        let discovered = discoverDoeLinksFromStructuredTable(html, raw.sourceUrl);
        if (discovered.length === 0) {
            discovered = discoverDoeLinksFallback(html, raw.sourceUrl);
        }
        // Only ask AI for help if deterministic discovery found nothing.
        if (discovered.length === 0) {
            const aiResult = await (0, aiService_1.discoverLatestLinksWithAi)(raw.sourceUrl, html);
            if (aiResult && aiResult.links.length > 0) {
                for (const link of aiResult.links) {
                    if (!link.isLatest)
                        continue;
                    const url = absolutize(raw.sourceUrl, link.url);
                    discovered.push({
                        url,
                        publishedAt: (0, dateInference_1.inferDoeDocumentDateFromUrl)(url),
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
        const ai = await (0, doeFreshnessAiService_1.validateLatestDoeDocWithAi)({
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
        const docWithinAllowedWindow = Number.isFinite(aiDocDate.getTime()) && aiConfidencePass(ai.confidence) && aiDocDate >= cutoff && aiDocDate <= now;
        if (!docWithinAllowedWindow) {
            // Fail-closed: do not upsert any DOE PDF raws if freshness cannot be verified.
            await RawScrapedSource_1.RawScrapedSource.updateOne({ sourceUrl: raw.sourceUrl, parserId: raw.parserId }, {
                $set: {
                    errorMessage: `DOE freshness guard blocked: ${ai.reason}`,
                },
            }).catch(() => { });
            return { ok: true, items: [] };
        }
        await RawScrapedSource_1.RawScrapedSource.updateOne({ sourceUrl: ai.latestDocUrl, parserId: constants_1.DOE_PDF_PARSER_ID }, {
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
                parserId: constants_1.DOE_PDF_PARSER_ID,
                scrapedAt: now,
                parserVersion: raw.parserVersion,
                processingStatus: "raw",
            },
        }, { upsert: true });
        return { ok: true, items: [] };
    },
};
function aiConfidencePass(confidence) {
    return typeof confidence === "number" && confidence >= 0.65;
}
