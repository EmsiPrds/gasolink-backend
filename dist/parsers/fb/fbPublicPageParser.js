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
exports.fbPublicPageParser = void 0;
const cheerio = __importStar(require("cheerio"));
const confidence_1 = require("../../normalization/confidence");
const deltaExtract_1 = require("../shared/deltaExtract");
const regions = ["NCR", "Luzon", "Visayas", "Mindanao"];
function inferCompanyName(sourceName, sourceUrl) {
    const combined = `${sourceName} ${sourceUrl}`.toLowerCase();
    const mappings = [
        ["petron", "Petron"],
        ["shell", "Shell"],
        ["caltex", "Caltex"],
        ["seaoil", "SeaOil"],
        ["unioil", "Unioil"],
        ["phoenix", "Phoenix"],
        ["cleanfuel", "Cleanfuel"],
    ];
    return mappings.find(([keyword]) => combined.includes(keyword))?.[1];
}
function extractOutboundLinks($) {
    const links = new Set();
    $("a[href]").each((_, el) => {
        const href = String($(el).attr("href") ?? "");
        if (!href)
            return;
        if (!href.startsWith("http"))
            return;
        // Keep non-Facebook links for provenance (official advisories often link out)
        if (href.includes("facebook.com"))
            return;
        links.add(href);
    });
    return Array.from(links).slice(0, 10);
}
exports.fbPublicPageParser = {
    id: "fb_public_page_v1",
    canHandle: (raw) => raw.parserId === "fb_public_page_v1",
    parse: async (raw) => {
        const html = raw.rawHtml ?? "";
        if (!html)
            return { ok: false, error: "No HTML to parse" };
        const $ = cheerio.load(html);
        const pageText = $.text();
        // Fail closed: require BOTH deltas and an effectivity date to reduce false positives.
        const deltas = (0, deltaExtract_1.extractFuelDeltas)(pageText);
        const effectiveAt = (0, deltaExtract_1.extractEffectivity)(pageText);
        if (deltas.length === 0 || !effectiveAt)
            return { ok: true, items: [] };
        const outboundLinks = extractOutboundLinks($);
        const sourceType = raw.sourceType;
        const statusLabel = (0, confidence_1.statusLabelForSourceType)(sourceType);
        const confidenceScore = (0, confidence_1.confidenceForSourceType)(sourceType);
        const scrapedAt = raw.scrapedAt ?? new Date();
        const companyName = inferCompanyName(raw.sourceName, raw.sourceUrl);
        const items = [];
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
