import type { SourceParser } from "../parserTypes";
import { confidenceForSourceType, statusLabelForSourceType } from "../../normalization/confidence";
import type { NormalizedCandidate } from "../parserTypes";
import { extractEffectivity } from "../shared/deltaExtract";
import { extractPdfText } from "../../services/pdfTextService";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

function normalizePdfText(text: string): string {
  // PDFs often contain weird line breaks and whitespace between characters.
  // Normalize before running regex-based extraction.
  let t = text.replace(/\r\n?/g, "\n");
  t = t.replace(/\u00A0/g, " ");
  t = t.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
  t = t.replace(/[ \t]+/g, " ");
  // Fix cases like "7 7 . 0 0" => "77.00"
  t = t.replace(/(\d)\s+(?=\d)/g, "$1");
  return t.trim();
}

/**
 * DOE PDFs sometimes get extracted with spaces or punctuation inserted between letters.
 * Example: "G A S O L I N E" would not match a plain /gasoline/i.
 */
function buildTolerantWordPattern(word: string): string {
  const parts = word.trim().split(/\s+/g).filter(Boolean);

  const partToPattern = (part: string) => {
    const cleaned = part.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!cleaned) return "";
    // Allow any non-alphanumeric chars between letters.
    return cleaned
      .split("")
      .map((ch) => `${escapeRegex(ch)}[^a-z0-9]*`)
      .join("");
  };

  if (parts.length <= 1) return partToPattern(parts[0] ?? "");
  // For multi-word phrases: allow runs of non-alphanumerics between words.
  return parts.map(partToPattern).filter(Boolean).join("[^a-z0-9]+");
}

function extractNumberAfter(label: string, text: string): number | null {
  const labelPattern = buildTolerantWordPattern(label);
  const labelRe = new RegExp(labelPattern, "i");

  // Primary pattern: simple "Label: 77.00" style.
  const directRe = new RegExp(
    `${labelPattern}\\s*[:\\-]?\\s*(?:₱|P)?\\s*([0-9]+(?:\\.[0-9]+)?)`,
    "i",
  );
  const directMatch = text.match(directRe);
  if (directMatch) {
    const n = Number(directMatch[1]);
    if (Number.isFinite(n)) return n;
  }

  // Fallback for DOE summary tables like:
  // "Gasoline (RON97/100) ... 66.50 ... 83.79 ... 77.00"
  // where we want the last numeric value on the line (common price).
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!labelRe.test(line)) continue;
    const nums = line.match(/([0-9]+(?:\.[0-9]+)?)/g);
    if (!nums || nums.length === 0) continue;
    const last = Number(nums[nums.length - 1]);
    if (Number.isFinite(last)) return last;
  }

  return null;
}

function extractDeltaForFuel(fuel: string, text: string): number | null {
  // Matches patterns like: Gasoline +1.20, Diesel -0.50, Kerosene +0.30
  const fuelPattern = buildTolerantWordPattern(fuel);
  const re = new RegExp(
    `${fuelPattern}[^\\n\\r]*?([+\\-])\\s*(?:₱|P)?\\s*([0-9]+(?:\\.[0-9]+)?)`,
    "i",
  );
  const m = text.match(re);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const n = Number(m[2]);
  return Number.isFinite(n) ? sign * n : null;
}

function extractNumberAfterAny(labels: string[], text: string): number | null {
  for (const label of labels) {
    const v = extractNumberAfter(label, text);
    if (typeof v === "number") return v;
  }
  return null;
}

function extractDeltaForFuelAny(labels: string[], text: string): number | null {
  for (const label of labels) {
    const v = extractDeltaForFuel(label, text);
    if (typeof v === "number") return v;
  }
  return null;
}

export const doePdfParser: SourceParser = {
  id: "doe_pdf_v1",
  canHandle: (raw) => raw.parserId === "doe_pdf_v1",
  parse: async (raw) => {
    // Prefer using cached text on RawScrapedSource (e.g. admin DOE uploads),
    // and only fetch/parse the PDF again if needed.
    let text = raw.rawText as string | undefined;
    if (!text || !text.trim()) {
      const result = await extractPdfText({ url: raw.sourceUrl });
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

    // Try to infer effectivity from text (e.g. "effective March 19, 2026").
    const effectiveAt = extractEffectivity(normalized) ?? undefined;

    // Try to infer region from PDF text first.
    let region: "NCR" | "Luzon" | "Visayas" | "Mindanao" | null =
      /mindanao/i.test(normalized)
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
        const romanMap: Record<string, number> = {
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
          if (regNum <= 5) region = "Luzon";
          else if (regNum <= 8) region = "Visayas";
          else region = "Mindanao";
        }
      }
    }

    // If not present in text, fall back to the sourceName/url context.
    if (!region) {
      const name = raw.sourceName ?? "";
      const url = raw.sourceUrl ?? "";
      if (/NCR Pump Prices/i.test(name) || /NCR/i.test(url)) region = "NCR";
      else if (/South Luzon Pump Prices/i.test(name)) region = "Luzon";
      else if (/North Luzon Pump Prices/i.test(name)) region = "Luzon";
      else if (/Visayas Pump Prices/i.test(name)) region = "Visayas";
      else if (/Mindanao Pump Prices/i.test(name)) region = "Mindanao";
    }

    if (!region) return { ok: true, items: [] };

    const items: NormalizedCandidate[] = [];

    // Prefer extracting actual prices if present
    const gasPrice = extractNumberAfterAny(
      [
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
      ],
      normalized,
    );
    const dieselPrice = extractNumberAfterAny(
      ["Diesel", "Gasoil", "ULSD", "Diesel (ULSD)"],
      normalized,
    );
    const keroPrice = extractNumberAfterAny(["Kerosene", "Kero", "Jet A-1"], normalized);

    const sourceType = raw.sourceType;
    const statusLabel = statusLabelForSourceType(sourceType);
    const confidenceScore = confidenceForSourceType(sourceType);
    const now = raw.scrapedAt ?? new Date();

    const maybeAddPrice = (fuelType: "Gasoline" | "Diesel" | "Kerosene", price: number | null) => {
      if (typeof price !== "number") return;
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
        sourcePublishedAt: effectiveAt ?? now,
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

      const maybeAddDelta = (fuelType: "Gasoline" | "Diesel" | "Kerosene", delta: number | null) => {
        if (typeof delta !== "number") return;
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
          sourcePublishedAt: effectiveAt ?? now,
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

