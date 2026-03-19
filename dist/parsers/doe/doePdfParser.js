"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doePdfParser = void 0;
const pdfParseModule = require("pdf-parse");
const httpFetch_1 = require("../../scrapers/httpFetch");
const confidence_1 = require("../../normalization/confidence");
function extractNumberAfter(label, text) {
    const re = new RegExp(`${label}\\s*[:\\-]?\\s*(?:₱|P)?\\s*([0-9]+(?:\\.[0-9]+)?)`, "i");
    const m = text.match(re);
    if (!m)
        return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
}
function extractDeltaForFuel(fuel, text) {
    // Matches patterns like: Gasoline +1.20, Diesel -0.50, Kerosene +0.30
    const re = new RegExp(`${fuel}[^\\n\\r]*?([+\\-])\\s*(?:₱|P)?\\s*([0-9]+(?:\\.[0-9]+)?)`, "i");
    const m = text.match(re);
    if (!m)
        return null;
    const sign = m[1] === "-" ? -1 : 1;
    const n = Number(m[2]);
    return Number.isFinite(n) ? sign * n : null;
}
exports.doePdfParser = {
    id: "doe_pdf_v1",
    canHandle: (raw) => raw.parserId === "doe_pdf_v1",
    parse: async (raw) => {
        const fetched = await (0, httpFetch_1.fetchBinary)(raw.sourceUrl);
        if (fetched.status < 200 || fetched.status >= 300)
            return { ok: false, error: `HTTP ${fetched.status}` };
        const pdfParse = pdfParseModule.default ?? pdfParseModule;
        const parsed = await pdfParse(fetched.data);
        const text = parsed.text ?? "";
        if (!/diesel|gasoline|kerosene|pump price|oil monitor/i.test(text)) {
            return { ok: false, error: "PDF parsed but content did not match expected fuel patterns" };
        }
        // For now, we only emit high-confidence normalized records when we can unambiguously extract:
        // - Region (NCR/Luzon/Visayas/Mindanao) OR explicit NCR context in doc text
        // - Fuel type
        // - Either pricePerLiter OR priceChange
        const region = /mindanao/i.test(text)
            ? "Mindanao"
            : /visayas/i.test(text)
                ? "Visayas"
                : /ncr|metro manila/i.test(text)
                    ? "NCR"
                    : /luzon/i.test(text)
                        ? "Luzon"
                        : null;
        if (!region)
            return { ok: true, items: [] };
        const items = [];
        // Prefer extracting actual prices if present
        const gasPrice = extractNumberAfter("Gasoline", text);
        const dieselPrice = extractNumberAfter("Diesel", text);
        const keroPrice = extractNumberAfter("Kerosene", text);
        const sourceType = raw.sourceType;
        const statusLabel = (0, confidence_1.statusLabelForSourceType)(sourceType);
        const confidenceScore = (0, confidence_1.confidenceForSourceType)(sourceType);
        const now = raw.scrapedAt ?? new Date();
        const maybeAddPrice = (fuelType, price) => {
            if (typeof price !== "number")
                return;
            items.push({
                sourceType,
                statusLabel,
                confidenceScore,
                fuelType,
                region,
                pricePerLiter: price,
                currency: "PHP",
                sourceName: raw.sourceName,
                sourceUrl: raw.sourceUrl,
                scrapedAt: now,
            });
        };
        maybeAddPrice("Gasoline", gasPrice);
        maybeAddPrice("Diesel", dieselPrice);
        maybeAddPrice("Kerosene", keroPrice);
        // If prices weren't present, try deltas (Oil Monitor weekly adjustments)
        if (items.length === 0) {
            const gasDelta = extractDeltaForFuel("Gasoline", text);
            const dieselDelta = extractDeltaForFuel("Diesel", text);
            const keroDelta = extractDeltaForFuel("Kerosene", text);
            const maybeAddDelta = (fuelType, delta) => {
                if (typeof delta !== "number")
                    return;
                items.push({
                    sourceType,
                    statusLabel,
                    confidenceScore,
                    fuelType,
                    region,
                    priceChange: delta,
                    currency: "PHP",
                    sourceName: raw.sourceName,
                    sourceUrl: raw.sourceUrl,
                    scrapedAt: now,
                });
            };
            maybeAddDelta("Gasoline", gasDelta);
            maybeAddDelta("Diesel", dieselDelta);
            maybeAddDelta("Kerosene", keroDelta);
        }
        return { ok: true, items };
    },
};
