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
function isProbablyDoeArticleUrl(url) {
    return url.startsWith("https://doe.gov.ph/articles/");
}
function isProbablyDoePdfUrl(url) {
    return url.includes("/sites/default/files/pdf/");
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
            if (isProbablyDoeArticleUrl(abs) || isProbablyDoePdfUrl(abs))
                links.add(abs);
        });
        // Side-effect: enqueue discovered articles/pdfs as raw snapshots for later parsing.
        // We do not emit normalized records here because listings usually require following the link.
        const discovered = Array.from(links);
        const now = new Date();
        for (const url of discovered) {
            await RawScrapedSource_1.RawScrapedSource.create({
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
