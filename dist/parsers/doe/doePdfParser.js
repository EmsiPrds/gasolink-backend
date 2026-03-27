"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doePdfParser = void 0;
const confidence_1 = require("../../normalization/confidence");
const deltaExtract_1 = require("../shared/deltaExtract");
const pdfTextService_1 = require("../../services/pdfTextService");
const dateInference_1 = require("./dateInference");
const constants_1 = require("./constants");
const doeFreshnessAiService_1 = require("../../services/doeFreshnessAiService");
const MAX_DOE_DOC_AGE_DAYS = 14;
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}
function normalizePdfText(text) {
    // PDFs often contain weird line breaks and whitespace between characters.
    // Normalize before running regex-based extraction.
    let t = text.replace(/\r\n?/g, "\n");
    t = t.replace(/\u00A0/g, " ");
    // Preserve newlines so table rows can still be parsed line by line.
    t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
    t = t.replace(/[ \t]+/g, " ");
    return t.trim();
}
/**
 * DOE PDFs sometimes get extracted with spaces or punctuation inserted between letters.
 * Example: "G A S O L I N E" would not match a plain /gasoline/i.
 */
function buildTolerantWordPattern(word) {
    const parts = word.trim().split(/\s+/g).filter(Boolean);
    const partToPattern = (part) => {
        const cleaned = part.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!cleaned)
            return "";
        // Allow any non-alphanumeric chars between letters.
        return cleaned
            .split("")
            .map((ch) => `${escapeRegex(ch)}[^a-z0-9]*`)
            .join("");
    };
    if (parts.length <= 1)
        return partToPattern(parts[0] ?? "");
    // For multi-word phrases: allow runs of non-alphanumerics between words.
    return parts.map(partToPattern).filter(Boolean).join("[^a-z0-9]+");
}
function extractNumberAfter(label, text) {
    const labelPattern = buildTolerantWordPattern(label);
    const labelRe = new RegExp(labelPattern, "i");
    // Primary pattern: simple "Label: 77.00" style.
    const directRe = new RegExp(`${labelPattern}\\s*[:\\-]?\\s*(?:₱|P)?\\s*([0-9]+(?:\\.[0-9]+)?)`, "i");
    const directMatch = text.match(directRe);
    if (directMatch) {
        const n = Number(directMatch[1]);
        if (Number.isFinite(n) && n > 0 && n < 200)
            return n;
    }
    // Fallback for DOE summary tables like:
    // "Gasoline (RON97/100) ... 66.50 ... 83.79 ... 77.00"
    // where we want the last numeric value on the line (common price).
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        if (!labelRe.test(line))
            continue;
        const nums = line.match(/([0-9]+(?:\.[0-9]+)?)/g);
        if (!nums || nums.length === 0)
            continue;
        // We expect the common/average price to be within a sane range.
        // If multiple numbers are on the line, iterate backwards to find a sane price.
        for (let i = nums.length - 1; i >= 0; i--) {
            const val = Number(nums[i]);
            if (Number.isFinite(val) && val > 30 && val < 150) {
                return val;
            }
        }
    }
    return null;
}
function extractDeltaForFuel(fuel, text) {
    // Matches patterns like: Gasoline +1.20, Diesel -0.50, Kerosene +0.30
    const fuelPattern = buildTolerantWordPattern(fuel);
    const re = new RegExp(`${fuelPattern}[^\\n\\r]*?([+\\-])\\s*(?:₱|P)?\\s*([0-9]+(?:\\.[0-9]+)?)`, "i");
    const m = text.match(re);
    if (!m)
        return null;
    const sign = m[1] === "-" ? -1 : 1;
    const n = Number(m[2]);
    return Number.isFinite(n) ? sign * n : null;
}
function extractNumberAfterAny(labels, text) {
    for (const label of labels) {
        const v = extractNumberAfter(label, text);
        if (typeof v === "number")
            return v;
    }
    return null;
}
function extractDeltaForFuelAny(labels, text) {
    for (const label of labels) {
        const v = extractDeltaForFuel(label, text);
        if (typeof v === "number")
            return v;
    }
    return null;
}
function average(values) {
    if (values.length === 0)
        return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function extractCommonPricesForLinePattern(text, linePattern) {
    const values = [];
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
        if (!line || !linePattern.test(line))
            continue;
        const withoutNa = line.replace(/#N\/A/gi, "").trim();
        const numbers = withoutNa.match(/[0-9]+(?:\.[0-9]+)?/g) ?? [];
        if (numbers.length === 0)
            continue;
        for (let i = numbers.length - 1; i >= 0; i--) {
            const candidate = Number(numbers[i]);
            if (Number.isFinite(candidate) && candidate > 20 && candidate < 200) {
                values.push(candidate);
                break;
            }
        }
    }
    return values;
}
function extractPriceFromModernDoeTable(text, fuelType) {
    switch (fuelType) {
        case "Gasoline": {
            const ron91 = extractCommonPricesForLinePattern(text, /^\s*RON\s*91\b/i);
            if (ron91.length > 0)
                return average(ron91);
            const ron95 = extractCommonPricesForLinePattern(text, /^\s*RON\s*95\b/i);
            if (ron95.length > 0)
                return average(ron95);
            const gasoline = extractCommonPricesForLinePattern(text, /^\s*GASOLINE\b/i);
            if (gasoline.length > 0)
                return average(gasoline);
            const ron97 = extractCommonPricesForLinePattern(text, /^\s*RON\s*97\b/i);
            if (ron97.length > 0)
                return average(ron97);
            return null;
        }
        case "Diesel": {
            const diesel = extractCommonPricesForLinePattern(text, /^\s*DIESEL(?!\s*PLUS)\b/i);
            return average(diesel);
        }
        case "Kerosene": {
            const kerosene = extractCommonPricesForLinePattern(text, /^\s*KEROSENE\b/i);
            return average(kerosene);
        }
        default:
            return null;
    }
}
exports.doePdfParser = {
    id: constants_1.DOE_PDF_PARSER_ID,
    canHandle: (raw) => raw.parserId === constants_1.DOE_PDF_PARSER_ID || raw.parserId === "doe_pdf_v1",
    parse: async (raw) => {
        // Prefer using cached text on RawScrapedSource (e.g. admin DOE uploads),
        // and only fetch/parse the PDF again if needed.
        let text = raw.rawText;
        if (!text || !text.trim()) {
            const result = await (0, pdfTextService_1.extractPdfText)({ url: raw.sourceUrl });
            if (!result.ok) {
                return { ok: false, error: result.error };
            }
            text = result.text;
        }
        // Normalize the extracted text to make regex extraction more reliable.
        const normalized = normalizePdfText(text);
        // Avoid hard-failing based on whether fuel keywords exist with exact spacing.
        // If we can't extract any digits at all, it's almost certainly a non-useful PDF text extraction.
        if (!/[0-9]/.test(normalized)) {
            return { ok: false, error: "PDF parsed but content did not match expected fuel patterns" };
        }
        const now = raw.scrapedAt ?? new Date();
        const deterministicDate = (0, deltaExtract_1.extractEffectivity)(normalized) ??
            (0, dateInference_1.inferDoeDocumentDateFromText)(normalized) ??
            (raw.sourcePublishedAt instanceof Date ? raw.sourcePublishedAt : null) ??
            (0, dateInference_1.inferDoeDocumentDateFromUrl)(raw.sourceUrl);
        // OpenAI freshness guard: verify document date within allowed weekly window (fail-closed).
        const ai = await (0, doeFreshnessAiService_1.validateLatestDoeDocWithAi)({
            now,
            listingUrl: raw.sourceUrl,
            candidates: [{ url: raw.sourceUrl, label: raw.sourceName, publishedAtHint: deterministicDate ? new Date(deterministicDate).toISOString() : null }],
            pdfTextSnippet: normalized.slice(0, 12000),
        });
        const aiDocDate = new Date(ai.documentDate);
        const cutoff = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000);
        if (!Number.isFinite(aiDocDate.getTime()) || ai.confidence < 0.65 || aiDocDate < cutoff || aiDocDate > now) {
            return { ok: false, error: `DOE freshness guard blocked: ${ai.reason}` };
        }
        const documentDate = aiDocDate;
        const effectiveAt = documentDate;
        // Try to infer region from PDF text first.
        let region = /mindanao/i.test(normalized)
            ? "Mindanao"
            : /visayas/i.test(normalized)
                ? "Visayas"
                : /ncr|metro manila/i.test(normalized)
                    ? "NCR"
                    : /luzon/i.test(normalized)
                        ? "Luzon"
                        : null;
        // DOE region headings may use "REGION IV-A", "REGION VIII", etc.
        // Map those to our broad geographic buckets.
        if (!region) {
            const regionMatch = normalized.match(/region\s*(?:-|\s*)?(i{1,3}|iv|v|vi{1,3}|vii|viii|ix|x|xi|xii|xiii)(?:[-\s]*[a-d])?/i);
            if (regionMatch) {
                const rom = regionMatch[1].toUpperCase();
                const romanMap = {
                    I: 1,
                    II: 2,
                    III: 3,
                    IV: 4,
                    V: 5,
                    VI: 6,
                    VII: 7,
                    VIII: 8,
                    IX: 9,
                    X: 10,
                    XI: 11,
                    XII: 12,
                    XIII: 13,
                };
                const regNum = romanMap[rom] ?? NaN;
                // Map DOE region numbers into broad groups:
                // 1-5 = Luzon, 6-8 = Visayas, 9+ = Mindanao
                if (!Number.isNaN(regNum)) {
                    if (regNum <= 5)
                        region = "Luzon";
                    else if (regNum <= 8)
                        region = "Visayas";
                    else
                        region = "Mindanao";
                }
            }
        }
        // If not present in text, fall back to the sourceName/url context.
        if (!region) {
            const name = raw.sourceName ?? "";
            const url = raw.sourceUrl ?? "";
            if (/NCR Pump Prices/i.test(name) || /NCR/i.test(url))
                region = "NCR";
            else if (/South Luzon Pump Prices/i.test(name))
                region = "Luzon";
            else if (/North Luzon Pump Prices/i.test(name))
                region = "Luzon";
            else if (/Visayas Pump Prices/i.test(name))
                region = "Visayas";
            else if (/Mindanao Pump Prices/i.test(name))
                region = "Mindanao";
        }
        if (!region)
            return { ok: true, items: [] };
        const items = [];
        // Prefer extracting actual prices if present
        const gasPrice = extractPriceFromModernDoeTable(normalized, "Gasoline") ??
            extractNumberAfterAny([
                "Gasoline",
                "Petrol",
                "Mogas",
                "Gasol",
                "Unleaded",
                // Common DOE table labels
                "RON 97",
                "RON97",
                "RON 100",
                "RON100",
                "RON 95",
                "RON95",
            ], normalized);
        const dieselPrice = extractPriceFromModernDoeTable(normalized, "Diesel") ??
            extractNumberAfterAny(["Diesel", "Gasoil", "ULSD", "Diesel (ULSD)"], normalized);
        const keroPrice = extractPriceFromModernDoeTable(normalized, "Kerosene") ??
            extractNumberAfterAny(["Kerosene", "Kero", "Jet A-1"], normalized);
        const sourceType = raw.sourceType;
        const statusLabel = (0, confidence_1.statusLabelForSourceType)(sourceType);
        const confidenceScore = (0, confidence_1.confidenceForSourceType)(sourceType);
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
                effectiveAt: effectiveAt ?? undefined,
                sourcePublishedAt: documentDate,
            });
        };
        maybeAddPrice("Gasoline", gasPrice);
        maybeAddPrice("Diesel", dieselPrice);
        maybeAddPrice("Kerosene", keroPrice);
        // If prices weren't present, try deltas (Oil Monitor weekly adjustments)
        if (items.length === 0) {
            const gasDelta = extractDeltaForFuelAny(["Gasoline", "Petrol", "Mogas", "Unleaded", "RON 97", "RON97"], normalized);
            const dieselDelta = extractDeltaForFuelAny(["Diesel", "Gasoil", "ULSD"], normalized);
            const keroDelta = extractDeltaForFuelAny(["Kerosene", "Kero", "Jet A-1"], normalized);
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
                    effectiveAt: effectiveAt ?? undefined,
                    sourcePublishedAt: documentDate,
                });
            };
            maybeAddDelta("Gasoline", gasDelta);
            maybeAddDelta("Diesel", dieselDelta);
            maybeAddDelta("Kerosene", keroDelta);
        }
        // If we inferred a region but extracted nothing, treat it as failure.
        // This prevents misleading "normalized" raws with no NormalizedFuelRecord inserts.
        if (items.length === 0) {
            return { ok: false, error: "DOE PDF parsed but no fuel prices/deltas extracted" };
        }
        return { ok: true, items };
    },
};
