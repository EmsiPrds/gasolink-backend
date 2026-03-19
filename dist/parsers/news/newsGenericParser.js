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
exports.newsGenericParser = void 0;
const cheerio = __importStar(require("cheerio"));
const confidence_1 = require("../../normalization/confidence");
const deltaExtract_1 = require("../shared/deltaExtract");
const regions = ["NCR", "Luzon", "Visayas", "Mindanao"];
exports.newsGenericParser = {
    id: "news_generic_v1",
    canHandle: (raw) => raw.parserId === "news_generic_v1",
    parse: async (raw) => {
        const html = raw.rawHtml ?? "";
        const text = raw.rawText ?? "";
        const combined = html ? cheerio.load(html).text() : text;
        const deltas = (0, deltaExtract_1.extractFuelDeltas)(combined);
        const effectiveAt = (0, deltaExtract_1.extractEffectivity)(combined);
        // News often mentions deltas without exact timing; fail closed if timing is missing.
        if (deltas.length === 0 || !effectiveAt)
            return { ok: true, items: [] };
        const sourceType = raw.sourceType; // company_advisory (corroboration)
        const statusLabel = (0, confidence_1.statusLabelForSourceType)(sourceType);
        const confidenceScore = (0, confidence_1.confidenceForSourceType)(sourceType);
        const scrapedAt = raw.scrapedAt ?? new Date();
        const items = [];
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
