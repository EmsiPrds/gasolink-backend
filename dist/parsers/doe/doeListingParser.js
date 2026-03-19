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
function extractDateFromDoeUrl(url) {
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
exports.doeListingParser = {
    id: "doe_listing_v1",
    canHandle: (raw) => raw.parserId === "doe_listing_v1",
    parse: async (raw) => {
        const html = raw.rawHtml ?? "";
        if (!html)
            return { ok: false, error: "No HTML to parse" };
        const $ = cheerio.load(html);
        const links = new Set();
        $("a[href]").each((_, el) => {
            const href = String($(el).attr("href") ?? "").trim();
            if (!href)
                return;
            const abs = absolutize(raw.sourceUrl, href);
            if (isProbablyDoePdfUrl(abs))
                links.add(abs);
        });
        // Also scan for any standalone PDF references in the HTML body.
        // Some DOE pages may not include standard <a href> tags or may embed PDF links in scripts.
        const pdfMatches = html.matchAll(/(https?:\/\/[^"'\s>]+\.pdf)/gi);
        for (const match of pdfMatches) {
            links.add(String(match[1]));
        }
        const discovered = Array.from(links);
        if (discovered.length === 0) {
            return { ok: true, items: [] };
        }
        const now = new Date();
        // Enqueue all discovered PDF links, but avoid duplicates.
        for (const url of discovered) {
            const abs = absolutize(raw.sourceUrl, url);
            // Upsert to avoid duplicate work; keep first seen record.
            await RawScrapedSource_1.RawScrapedSource.updateOne({ sourceUrl: abs, parserId: "doe_pdf_v1" }, {
                $setOnInsert: {
                    sourceType: raw.sourceType,
                    sourceName: raw.sourceName,
                    sourceUrl: abs,
                    parserId: "doe_pdf_v1",
                    scrapedAt: now,
                    parserVersion: raw.parserVersion,
                    processingStatus: "raw",
                },
            }, { upsert: true });
        }
        return { ok: true, items: [] };
    },
};
