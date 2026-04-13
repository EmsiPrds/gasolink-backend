import path from "path";
import type { Types } from "mongoose";
import { RawScrapedSource } from "../models/RawScrapedSource";
import { NormalizedFuelRecord } from "../models/NormalizedFuelRecord";
import { FinalPublishedFuelPrice } from "../models/FinalPublishedFuelPrice";
import { FuelPricePH } from "../models/FuelPricePH";
import { UpdateLog } from "../models/UpdateLog";
import { extractPdfText } from "./pdfTextService";
import { doePdfParser } from "../parsers/doe/doePdfParser";
import { fetchStatic } from "../utils/http";
import { buildFingerprint } from "../normalization/fingerprint";
import { validateCandidate } from "../normalization/validators";
import { DOE_PDF_PARSER_ID } from "../parsers/doe/constants";
import { extractDoeUploadText } from "./doeUploadTextService";
import { runAiPriceEstimation } from "../reconciliation/aiPriceEstimation";
import { cleanupOutdatedDoeData } from "./doeLatestCleanupService";
import { runDataQualityMonitor } from "../quality/dataQualityMonitor";
import { env } from "../config/env";

const MAX_MANUAL_DOE_DOC_AGE_DAYS = 14;
const MAX_FUTURE_EFFECTIVE_DAYS = 3;

function isBlockedDoeUrl(url: string): boolean {
  return /(typhoon|price-freeze|price%20freeze|bayanihan|relief)/i.test(url);
}

function isAllowedDoeDomain(url: string): boolean {
  if (url.startsWith("local:")) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "doe.gov.ph" || host.endsWith(".doe.gov.ph");
  } catch {
    return false;
  }
}

function validateEffectiveAtWindow(date: Date): boolean {
  const now = Date.now();
  const minMs = now - MAX_MANUAL_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000;
  const maxMs = now + MAX_FUTURE_EFFECTIVE_DAYS * 24 * 60 * 60 * 1000;
  const t = date.getTime();
  return Number.isFinite(t) && t >= minMs && t <= maxMs;
}

type AdminId = Types.ObjectId | string;

export type DoePreviewRow = {
  tempId: string;
  fuelType: string;
  pricePerLiter?: number;
  priceChange?: number;
  priceAdjustmentDirection?: "up" | "down";
  previousPrice?: number;
  latestPrice?: number;
  effectiveAt?: string;
  region?: string;
  area?: string;
  companyName?: string;
  sourceUrl: string;
  warnings?: string[];
};

export type DoePreviewPayload = {
  rawSourceId: string;
  rows: DoePreviewRow[];
  warnings: string[];
  rawTextSample: string;
};

export type DoeCommitRow = {
  tempId: string;
  include: boolean;
  fuelType: string;
  pricePerLiter?: number;
  priceChange?: number;
  effectiveAt?: string;
  region: string;
  area?: string;
  companyName?: string;
};

type DoeAiCommitInterpretation = {
  parseConfidence: number;
  detectedEffectiveAt?: string;
  warnings: string[];
  summary: string;
};

async function analyzeDoeCommitRowsWithAi(rows: DoeCommitRow[]): Promise<DoeAiCommitInterpretation> {
  const included = rows.filter((row) => row.include);
  if (included.length === 0) {
    return {
      parseConfidence: 0,
      warnings: ["No rows were selected for commit."],
      summary: "No included rows to analyze.",
    };
  }

  const effectiveDates = included
    .map((row) => row.effectiveAt)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort();

  if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY.includes("replace_me")) {
    return {
      parseConfidence: 0.7,
      detectedEffectiveAt: effectiveDates[effectiveDates.length - 1],
      warnings: ["OPENAI_API_KEY missing; used deterministic validation summary."],
      summary: "Manual DOE rows accepted with deterministic validation.",
    };
  }

  const prompt = `You are validating manually-uploaded DOE fuel records before publish.
Return ONLY JSON:
{
  "parseConfidence": number,
  "detectedEffectiveAt": "ISO date string or null",
  "warnings": string[],
  "summary": string
}

Rows:
${JSON.stringify(included).slice(0, 14000)}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      parseConfidence: 0.65,
      detectedEffectiveAt: effectiveDates[effectiveDates.length - 1],
      warnings: [`AI validation request failed (${response.status}). ${body.slice(0, 180)}`],
      summary: "Fell back to deterministic validation after AI request failure.",
    };
  }

  const json = (await response.json()) as any;
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    return {
      parseConfidence: 0.65,
      detectedEffectiveAt: effectiveDates[effectiveDates.length - 1],
      warnings: ["AI validation returned empty content."],
      summary: "Fell back to deterministic validation after empty AI response.",
    };
  }

  try {
    const parsed = JSON.parse(content) as {
      parseConfidence?: number;
      detectedEffectiveAt?: string | null;
      warnings?: string[];
      summary?: string;
    };
    const parseConfidence = Math.max(0, Math.min(1, Number(parsed.parseConfidence ?? 0.65)));
    return {
      parseConfidence,
      detectedEffectiveAt: parsed.detectedEffectiveAt ?? effectiveDates[effectiveDates.length - 1],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "AI validation completed.",
    };
  } catch {
    return {
      parseConfidence: 0.65,
      detectedEffectiveAt: effectiveDates[effectiveDates.length - 1],
      warnings: ["AI validation JSON parse failed; using deterministic fallback."],
      summary: "Fallback validation used due to malformed AI output.",
    };
  }
}

export async function createDoeRawFromUpload(params: {
  adminId: AdminId;
  localPath: string;
  originalFilename: string;
  mimeType?: string;
  note?: string;
}): Promise<DoePreviewPayload> {
  const sourceUrl = `local:${path.basename(params.originalFilename)}`;

  const textResult = await extractDoeUploadText({
    localPath: params.localPath,
    originalFilename: params.originalFilename,
    mimeType: params.mimeType,
  });
  if (!textResult.ok) {
    await UpdateLog.create({
      module: "admin_doe",
      status: "failure",
      message: `Failed to extract DOE text from upload ${params.originalFilename}: ${textResult.error}`,
      timestamp: new Date(),
    }).catch(() => {});
    throw new Error(textResult.error);
  }

  const raw = await RawScrapedSource.create({
    sourceType: "official_local",
    sourceName: "DOE",
    sourceUrl,
    parserId: DOE_PDF_PARSER_ID,
    rawText: textResult.text,
    scrapedAt: new Date(),
    parserVersion: "v1",
    processingStatus: "raw",
    isManualAdminSource: true,
    uploadContext: {
      uploadedBy: params.adminId,
      uploadType: textResult.format,
      originalFilename: params.originalFilename,
      note: params.note,
    },
  });

  const preview = await buildDoePreviewFromRaw(raw._id.toString(), textResult.warnings);
  return preview;
}

export async function createDoeRawFromLink(params: {
  adminId: AdminId;
  url: string;
  note?: string;
}): Promise<DoePreviewPayload> {
  const url = params.url;
  if (!isAllowedDoeDomain(url)) {
    throw new Error("Only DOE links from doe.gov.ph are allowed.");
  }
  if (isBlockedDoeUrl(url)) {
    throw new Error("DOE link appears to be a non-market advisory and is blocked.");
  }

  let text: string | null = null;
  let finalPdfUrl = url;
  const warnings: string[] = [];

  if (url.toLowerCase().endsWith(".pdf")) {
    const textResult = await extractPdfText({ url });
    if (!textResult.ok) {
      await UpdateLog.create({
        module: "admin_doe",
        status: "failure",
        message: `Failed to extract DOE PDF text from URL ${url}: ${textResult.error}`,
        timestamp: new Date(),
      }).catch(() => {});
      throw new Error(textResult.error);
    }
    text = textResult.text;
  } else {
    const fetched = await fetchStatic(url);
    if (fetched.status < 200 || fetched.status >= 300) {
      throw new Error(`HTTP ${fetched.status} for DOE URL ${url}`);
    }
    const htmlBody = fetched.html ?? "";
    const pdfMatch = htmlBody.match(/href=["']([^"']+\.pdf)["']/i);
    if (!pdfMatch) {
      warnings.push("No PDF link found on DOE page; parsed page content directly.");
      text = fetched.text ?? null;
    } else {
      finalPdfUrl = new URL(pdfMatch[1], url).toString();
      const textResult = await extractPdfText({ url: finalPdfUrl });
      if (!textResult.ok) {
        await UpdateLog.create({
          module: "admin_doe",
          status: "failure",
          message: `Failed to extract DOE PDF text from expanded URL ${finalPdfUrl}: ${textResult.error}`,
          timestamp: new Date(),
        }).catch(() => {});
        throw new Error(textResult.error);
      }
      text = textResult.text;
    }
  }

  const raw = await RawScrapedSource.create({
    sourceType: "official_local",
    sourceName: "DOE",
    sourceUrl: finalPdfUrl,
    parserId: DOE_PDF_PARSER_ID,
    rawText: text,
    scrapedAt: new Date(),
    parserVersion: "v1",
    processingStatus: "raw",
    isManualAdminSource: true,
    uploadContext: {
      uploadedBy: params.adminId,
      uploadType: "link",
      originalUrl: url,
      note: params.note,
    },
  });

  const preview = await buildDoePreviewFromRaw(raw._id.toString(), warnings);
  return preview;
}

export async function buildDoePreviewFromRaw(
  rawSourceId: string,
  extraWarnings: string[] = [],
): Promise<DoePreviewPayload> {
  const raw = await RawScrapedSource.findById(rawSourceId);
  if (!raw) {
    throw new Error("Raw DOE source not found");
  }

  const parseResult = await doePdfParser.parse(raw as any);
  if (!parseResult.ok) {
    return {
      rawSourceId: raw._id.toString(),
      rows: [],
      warnings: [...extraWarnings, `Parser warning: ${parseResult.error}`],
      rawTextSample: typeof raw.rawText === "string" ? raw.rawText.slice(0, 4000) : "",
    };
  }

  const rows: DoePreviewRow[] = [];
  const rowWarnings: string[] = [];
  for (const [idx, item] of parseResult.items.entries()) {
    try {
      const validated = validateCandidate(item);
      const direction =
        typeof validated.priceChange === "number"
          ? validated.priceChange > 0
            ? "up"
            : validated.priceChange < 0
              ? "down"
              : undefined
          : undefined;

      rows.push({
        tempId: `cand-${idx}`,
        fuelType: validated.fuelType,
        pricePerLiter: validated.pricePerLiter ?? undefined,
        priceChange: validated.priceChange ?? undefined,
        priceAdjustmentDirection: direction,
        effectiveAt: validated.effectiveAt ? validated.effectiveAt.toISOString() : undefined,
        region: validated.region,
        companyName: validated.companyName ?? undefined,
        sourceUrl: validated.sourceUrl,
        warnings: [],
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      rowWarnings.push(`Row ${idx + 1}: ${msg}`);
    }
  }

  return {
    rawSourceId: raw._id.toString(),
    rows,
    warnings: [...extraWarnings, ...rowWarnings],
    rawTextSample: typeof raw.rawText === "string" ? raw.rawText.slice(0, 4000) : "",
  };
}

export async function commitDoePreview(params: {
  rawSourceId: string;
  rows: DoeCommitRow[];
}) {
  const raw = await RawScrapedSource.findById(params.rawSourceId);
  if (!raw) {
    throw new Error("Raw DOE source not found");
  }

  if (!isAllowedDoeDomain(raw.sourceUrl)) {
    throw new Error("Only DOE sources are allowed for manual commit.");
  }
  if (isBlockedDoeUrl(raw.sourceUrl)) {
    throw new Error("Blocked non-market DOE source URL.");
  }

  const aiInterpretation = await analyzeDoeCommitRowsWithAi(params.rows);
  let createdOrUpdated = 0;
  let newestEffectiveAt: Date | null = null;
  let staleRejected = 0;
  let invalidRejected = 0;
  const rowWarnings: string[] = [];
  const acceptedRows: Array<{
    fuelType: string;
    region: string;
    pricePerLiter: number;
    effectiveAt: Date;
    confidenceScore: number;
    finalStatus: "Official" | "Advisory";
  }> = [];
  for (const row of params.rows) {
    if (!row.include) continue;

    const effectiveAtDate = row.effectiveAt ? new Date(row.effectiveAt) : undefined;
    if (!effectiveAtDate || !validateEffectiveAtWindow(effectiveAtDate)) {
      staleRejected += 1;
      continue;
    }
    if (!row.region || !row.fuelType) {
      invalidRejected += 1;
      continue;
    }
    let publishPricePerLiter = row.pricePerLiter;
    let publishConfidence = 0.95;
    let publishStatus: "Official" | "Advisory" = "Official";
    if (typeof publishPricePerLiter !== "number" || !Number.isFinite(publishPricePerLiter) || publishPricePerLiter <= 0) {
      if (typeof row.priceChange === "number" && Number.isFinite(row.priceChange)) {
        const baseline = await FuelPricePH.findOne({ fuelType: row.fuelType as any, region: row.region as any })
          .sort({ updatedAt: -1 })
          .lean();
        const baselinePrice = typeof baseline?.price === "number" && Number.isFinite(baseline.price) ? baseline.price : null;
        if (baselinePrice != null) {
          publishPricePerLiter = baselinePrice + row.priceChange;
          publishConfidence = 0.8;
          publishStatus = "Advisory";
          rowWarnings.push(`Row ${row.tempId}: derived price from baseline (${baselinePrice.toFixed(2)}) + change (${row.priceChange.toFixed(2)}).`);
        }
      }
    }
    if (typeof publishPricePerLiter !== "number" || !Number.isFinite(publishPricePerLiter) || publishPricePerLiter <= 0) {
      invalidRejected += 1;
      rowWarnings.push(`Row ${row.tempId}: missing valid price and unable to derive from change.`);
      continue;
    }
    try {
      const validated = validateCandidate({
        sourceType: "official_local",
        statusLabel: "Official",
        confidenceScore: 1,
        companyName: row.companyName,
        stationName: undefined,
        fuelType: row.fuelType as any,
        productName: undefined,
        region: row.region as any,
        city: row.area,
        pricePerLiter: row.pricePerLiter,
        priceChange: row.priceChange,
        currency: "PHP",
        sourceName: raw.sourceName,
        sourceUrl: raw.sourceUrl,
        sourcePublishedAt: effectiveAtDate,
        scrapedAt: raw.scrapedAt ?? new Date(),
        effectiveAt: effectiveAtDate,
        updatedAt: new Date(),
        fingerprint: "",
        rawSourceId: raw._id,
        supportingSources: [],
      } as any);

      const fingerprint = buildFingerprint({
        sourceType: validated.sourceType,
        sourceUrl: validated.sourceUrl,
        sourcePublishedAt: validated.sourcePublishedAt ? validated.sourcePublishedAt.toISOString() : "",
        fuelType: validated.fuelType,
        region: validated.region,
        city: validated.city ?? "",
        pricePerLiter: validated.pricePerLiter ?? "",
        priceChange: validated.priceChange ?? "",
        effectiveAt: validated.effectiveAt ? validated.effectiveAt.toISOString() : "",
      });

      const existing = await NormalizedFuelRecord.findOne({ fingerprint }).lean();
      if (existing) {
        continue;
      }

      await NormalizedFuelRecord.updateOne(
        { fingerprint },
        {
          $setOnInsert: {
            ...validated,
            fingerprint,
            rawSourceId: raw._id,
            updatedAt: validated.scrapedAt,
          },
        },
        { upsert: true },
      );
      createdOrUpdated += 1;
      if (effectiveAtDate && (!newestEffectiveAt || effectiveAtDate > newestEffectiveAt)) {
        newestEffectiveAt = effectiveAtDate;
      }
      acceptedRows.push({
        fuelType: row.fuelType,
        region: row.region,
        pricePerLiter: publishPricePerLiter,
        effectiveAt: effectiveAtDate,
        confidenceScore: publishConfidence,
        finalStatus: publishStatus,
      });
    } catch (error) {
      invalidRejected += 1;
      const msg = error instanceof Error ? error.message : String(error);
      rowWarnings.push(`Row ${row.tempId}: ${msg}`);
      continue;
    }
  }

  await RawScrapedSource.updateMany(
    { sourceType: "official_local", sourceName: "DOE", _id: { $ne: raw._id } },
    { $set: { aiSelectedLatest: false } },
  );

  raw.aiSelectedLatest = true;
  raw.aiDocumentDate = newestEffectiveAt ?? new Date();
  raw.aiConfidence = Math.max(0.9, aiInterpretation.parseConfidence);
  raw.aiReason = aiInterpretation.summary;
  raw.processingStatus = "normalized";
  await raw.save();

  // Keep AI fusion available, but we publish operator-approved official prices after it
  // so the dashboard reflects exact DOE committed values.
  const estimationResult = createdOrUpdated > 0 ? await runAiPriceEstimation() : { estimations: 0 };
  let manualPublished = 0;
  for (const row of acceptedRows) {
    const publishKey = `manual_doe::${row.fuelType}::${row.region}`;
    await FinalPublishedFuelPrice.findOneAndUpdate(
      { publishKey },
      {
        displayType: "ph_final",
        fuelType: row.fuelType,
        region: row.region,
        finalPrice: row.pricePerLiter,
        averagePrice: row.pricePerLiter,
        priceChange: 0,
        finalStatus: row.finalStatus,
        confidenceScore: row.confidenceScore,
        confidenceLabel: row.confidenceScore >= 0.9 ? "Very High" : row.confidenceScore >= 0.75 ? "High" : "Medium",
        estimateExplanation:
          row.finalStatus === "Official"
            ? "Direct official DOE manual upload commit."
            : "DOE advisory-derived price from baseline + change.",
        sourceBreakdown: [
          {
            sourceCategory: "doe_official",
            sampleSize: 1,
            avgConfidence: row.confidenceScore,
            avgPrice: row.pricePerLiter,
            freshnessHours: 0,
          },
        ],
        lastVerifiedAt: new Date(),
        updatedAt: new Date(),
        publishKey,
        supportingSources: [
          {
            sourceType: "official_local",
            sourceName: raw.sourceName,
            sourceUrl: raw.sourceUrl,
            sourcePublishedAt: row.effectiveAt,
            scrapedAt: raw.scrapedAt ?? new Date(),
            parserVersion: "manual_doe_v1",
            confidenceScore: row.confidenceScore,
            statusLabel: row.finalStatus,
          },
        ],
      },
      { upsert: true },
    );
    manualPublished += 1;
  }
  const cleanupResult = await cleanupOutdatedDoeData();
  await runDataQualityMonitor();

  await UpdateLog.create({
    module: "admin_doe",
    status: "success",
    message: `DOE admin commit rawSourceId=${raw._id.toString()} createdOrUpdated=${createdOrUpdated} parseConfidence=${aiInterpretation.parseConfidence.toFixed(
      2,
    )} staleRejected=${staleRejected} invalidRejected=${invalidRejected} published=${manualPublished} fused=${estimationResult.estimations}`,
    timestamp: new Date(),
  }).catch(() => {});

  return {
    ok: true as const,
    createdOrUpdated,
    parseConfidence: aiInterpretation.parseConfidence,
    detectedEffectiveAt: aiInterpretation.detectedEffectiveAt,
    warnings: [...aiInterpretation.warnings, ...rowWarnings],
    aiSummary: aiInterpretation.summary,
    staleRejected,
    invalidRejected,
    publishedCount: manualPublished,
    cleanupNormalized: cleanupResult.deletedNormalized,
    cleanupPublished: cleanupResult.deletedPublished,
  };
}
