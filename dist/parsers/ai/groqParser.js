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
exports.groqParser = void 0;
const cheerio = __importStar(require("cheerio"));
const aiService_1 = require("../../services/aiService");
const confidence_1 = require("../../normalization/confidence");
exports.groqParser = {
    id: "ai_groq_v1",
    canHandle: (raw) => raw.parserId === "ai_groq_v1",
    parse: async (raw) => {
        const html = raw.rawHtml ?? "";
        const text = raw.rawText ?? "";
        // For HTML, we prefer the plain text content for AI analysis.
        const combined = html ? cheerio.load(html).text() : text;
        if (!combined.trim()) {
            return { ok: false, error: "No text content available for AI parsing." };
        }
        // Call the AI service to extract structured data.
        const aiResult = await (0, aiService_1.extractFuelDataWithAi)(combined);
        if (!aiResult || aiResult.items.length === 0) {
            return { ok: true, items: [] };
        }
        const sourceType = raw.sourceType;
        const statusLabel = (0, confidence_1.statusLabelForSourceType)(sourceType);
        const confidenceScore = (0, confidence_1.confidenceForSourceType)(sourceType) * aiResult.confidence;
        const scrapedAt = raw.scrapedAt ?? new Date();
        const items = aiResult.items
            .filter((item) => item.region && item.effectiveAt)
            .map((item) => ({
            sourceType,
            statusLabel,
            confidenceScore,
            fuelType: item.fuelType,
            region: item.region,
            city: item.city,
            pricePerLiter: item.pricePerLiter,
            priceChange: item.priceChange,
            currency: "PHP",
            sourceName: raw.sourceName,
            sourceUrl: raw.sourceUrl,
            scrapedAt,
            effectiveAt: item.effectiveAt ? new Date(item.effectiveAt) : undefined,
            sourcePublishedAt: item.effectiveAt ? new Date(item.effectiveAt) : undefined,
            companyName: item.companyName,
            productName: item.productName,
        }));
        return { ok: true, items };
    },
};
