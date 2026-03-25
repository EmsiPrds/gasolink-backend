import path from "path";
import type { Types } from "mongoose";
import { RawScrapedSource } from "../models/RawScrapedSource";
import { NormalizedFuelRecord } from "../models/NormalizedFuelRecord";
import { UpdateLog } from "../models/UpdateLog";
import { extractPdfText } from "./pdfTextService";
import { doePdfParser } from "../parsers/doe/doePdfParser";
import { fetchStatic } from "../utils/http";
import { buildFingerprint } from "../normalization/fingerprint";
import { validateCandidate } from "../normalization/validators";
import { DOE_PDF_PARSER_ID } from "../parsers/doe/constants";

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

export async function createDoeRawFromUpload(params: {
  adminId: AdminId;
  localPath: string;
  originalFilename: string;
  note?: string;
}): Promise<DoePreviewPayload> {
  const sourceUrl = `local:${path.basename(params.originalFilename)}`;

  const textResult = await extractPdfText({ localPath: params.localPath });
  if (!textResult.ok) {
    await UpdateLog.create({
      module: "admin_doe",
      status: "failure",
      message: `Failed to extract DOE PDF text from upload ${params.originalFilename}: ${textResult.error}`,
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
      uploadType: "file",
      originalFilename: params.originalFilename,
      note: params.note,
    },
  });

  const preview = await buildDoePreviewFromRaw(raw._id.toString());
  return preview;
}

export async function createDoeRawFromLink(params: {
  adminId: AdminId;
  url: string;
  note?: string;
}): Promise<DoePreviewPayload> {
  const url = params.url;

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
    throw new Error(parseResult.error);
  }

  const rows: DoePreviewRow[] = [];
  for (const [idx, item] of parseResult.items.entries()) {
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
  }

  return {
    rawSourceId: raw._id.toString(),
    rows,
    warnings: extraWarnings,
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

  let createdOrUpdated = 0;
  for (const row of params.rows) {
    if (!row.include) continue;

    const effectiveAtDate = row.effectiveAt ? new Date(row.effectiveAt) : undefined;
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
  }

  raw.processingStatus = "normalized";
  await raw.save();

  await UpdateLog.create({
    module: "admin_doe",
    status: "success",
    message: `DOE admin commit rawSourceId=${raw._id.toString()} createdOrUpdated=${createdOrUpdated}`,
    timestamp: new Date(),
  }).catch(() => {});

  return { ok: true as const, createdOrUpdated };
}
