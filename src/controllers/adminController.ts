import type { Request, Response } from "express";
import { ok } from "../utils/apiResponse";
import { httpStatus } from "../utils/httpStatus";
import { FuelPricePH } from "../models/FuelPricePH";
import { CompanyPrice } from "../models/CompanyPrice";
import { Insight } from "../models/Insight";
import { Alert } from "../models/Alert";
import { UpdateLog } from "../models/UpdateLog";
import { RawScrapedSource } from "../models/RawScrapedSource";
import { NormalizedFuelRecord } from "../models/NormalizedFuelRecord";
import { FinalPublishedFuelPrice } from "../models/FinalPublishedFuelPrice";
import { refreshGlobalPrices } from "../services/globalPriceService";
import { MockGlobalPriceProvider } from "../services/providers/MockGlobalPriceProvider";
import { collectorsQueue, qualityQueue } from "../queue/queues";
import { emitPipelineEvent } from "../realtime/socketServer";
import {
  AdminAlertBodySchema,
  AdminCompanyPriceBodySchema,
  AdminInsightBodySchema,
  AdminLogsQuerySchema,
  AdminPhPriceBodySchema,
  IdParamSchema,
} from "../validators/adminValidators";
import { normalizeSourceUrl } from "../utils/doeLatestPolicy";
const MAX_DOE_DOC_AGE_DAYS = 14;

type ActiveDoeDocument = null | {
  sourceUrl: string;
  documentDate: string;
  confidence?: number;
  reason?: string;
};

async function getActiveDoeDocument(now: Date): Promise<ActiveDoeDocument> {
  const from = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000);
  const raw = await RawScrapedSource.findOne({
    sourceType: "official_local",
    aiSelectedLatest: true,
    aiDocumentDate: { $gte: from, $lte: now },
  })
    .sort({ aiDocumentDate: -1, scrapedAt: -1 })
    .select({ sourceUrl: 1, aiDocumentDate: 1, aiConfidence: 1, aiReason: 1 })
    .lean();

  if (!raw?.sourceUrl || !(raw as any).aiDocumentDate) return null;
  return {
    sourceUrl: String(raw.sourceUrl),
    documentDate: new Date((raw as any).aiDocumentDate).toISOString(),
    confidence: typeof (raw as any).aiConfidence === "number" ? (raw as any).aiConfidence : undefined,
    reason: typeof (raw as any).aiReason === "string" ? (raw as any).aiReason : undefined,
  };
}

export async function adminSummary(_req: Request, res: Response) {
  const [phCount, companyCount, insightsCount, alertsCount] = await Promise.all([
    FuelPricePH.countDocuments({}),
    CompanyPrice.countDocuments({}),
    Insight.countDocuments({}),
    Alert.countDocuments({}),
  ]);
  return res.json(ok({ phCount, companyCount, insightsCount, alertsCount }));
}

// PH prices
export async function listPhPrices(_req: Request, res: Response) {
  const items = await FuelPricePH.find({}).sort({ updatedAt: -1 }).limit(500).lean();
  return res.json(ok({ items }));
}

export async function createPhPrice(req: Request, res: Response) {
  const body = AdminPhPriceBodySchema.parse(req.body);
  const created = await FuelPricePH.create({
    ...body,
    updatedAt: body.updatedAt ?? new Date(),
  });
  return res.status(httpStatus.created).json(ok({ item: created }));
}

export async function updatePhPrice(req: Request, res: Response) {
  const { id } = IdParamSchema.parse(req.params);
  const body = AdminPhPriceBodySchema.partial().parse(req.body);
  const updated = await FuelPricePH.findByIdAndUpdate(
    id,
    { ...body, ...(body.updatedAt ? { updatedAt: body.updatedAt } : {}) },
    { new: true },
  ).lean();
  return res.json(ok({ item: updated }));
}

export async function deletePhPrice(req: Request, res: Response) {
  const { id } = IdParamSchema.parse(req.params);
  await FuelPricePH.findByIdAndDelete(id);
  return res.json(ok({ deleted: true }));
}

// Company prices
export async function listCompanyPrices(_req: Request, res: Response) {
  const items = await CompanyPrice.find({}).sort({ updatedAt: -1 }).limit(500).lean();
  return res.json(ok({ items }));
}

export async function createCompanyPrice(req: Request, res: Response) {
  const body = AdminCompanyPriceBodySchema.parse(req.body);
  const created = await CompanyPrice.create({
    ...body,
    verifiedBy: body.status === "Verified" ? req.user?.sub : undefined,
    updatedAt: body.updatedAt ?? new Date(),
  });
  return res.status(httpStatus.created).json(ok({ item: created }));
}

export async function updateCompanyPrice(req: Request, res: Response) {
  const { id } = IdParamSchema.parse(req.params);
  const body = AdminCompanyPriceBodySchema.partial().parse(req.body);
  const patch: Record<string, unknown> = { ...body };
  if (body.status === "Verified") patch.verifiedBy = req.user?.sub;
  const updated = await CompanyPrice.findByIdAndUpdate(id, patch, { new: true }).lean();
  return res.json(ok({ item: updated }));
}

export async function deleteCompanyPrice(req: Request, res: Response) {
  const { id } = IdParamSchema.parse(req.params);
  await CompanyPrice.findByIdAndDelete(id);
  return res.json(ok({ deleted: true }));
}

// Insights
export async function listInsights(_req: Request, res: Response) {
  const items = await Insight.find({}).sort({ createdAt: -1 }).limit(500).lean();
  return res.json(ok({ items }));
}

export async function createInsight(req: Request, res: Response) {
  const body = AdminInsightBodySchema.parse(req.body);
  const created = await Insight.create({
    ...body,
    status: body.status ?? "active",
    createdAt: new Date(),
  });
  return res.status(httpStatus.created).json(ok({ item: created }));
}

export async function updateInsight(req: Request, res: Response) {
  const { id } = IdParamSchema.parse(req.params);
  const body = AdminInsightBodySchema.partial().parse(req.body);
  const updated = await Insight.findByIdAndUpdate(id, body, { new: true }).lean();
  return res.json(ok({ item: updated }));
}

export async function deleteInsight(req: Request, res: Response) {
  const { id } = IdParamSchema.parse(req.params);
  await Insight.findByIdAndDelete(id);
  return res.json(ok({ deleted: true }));
}

// Alerts
export async function listAlerts(_req: Request, res: Response) {
  const items = await Alert.find({}).sort({ createdAt: -1 }).limit(500).lean();
  return res.json(ok({ items }));
}

export async function createAlert(req: Request, res: Response) {
  const body = AdminAlertBodySchema.parse(req.body);
  const created = await Alert.create({
    ...body,
    level: body.level ?? "info",
    active: body.active ?? true,
    createdAt: new Date(),
  });
  return res.status(httpStatus.created).json(ok({ item: created }));
}

export async function updateAlert(req: Request, res: Response) {
  const { id } = IdParamSchema.parse(req.params);
  const body = AdminAlertBodySchema.partial().parse(req.body);
  const updated = await Alert.findByIdAndUpdate(id, body, { new: true }).lean();
  return res.json(ok({ item: updated }));
}

export async function deleteAlert(req: Request, res: Response) {
  const { id } = IdParamSchema.parse(req.params);
  await Alert.findByIdAndDelete(id);
  return res.json(ok({ deleted: true }));
}

// Logs
export async function listLogs(req: Request, res: Response) {
  const { module, status } = AdminLogsQuerySchema.parse(req.query);
  const q: Record<string, unknown> = {};
  if (module) q.module = module;
  if (status) q.status = status;
  const items = await UpdateLog.find(q).sort({ timestamp: -1 }).limit(500).lean();
  return res.json(ok({ items }));
}

// Manual refresh placeholder (real implementation wired in cron todo)
export async function refreshGlobalNow(_req: Request, res: Response) {
  const provider = new MockGlobalPriceProvider();
  const result = await refreshGlobalPrices(provider, { trigger: "manual" });
  return res.json(ok({ requested: true, ok: result.ok }));
}

// Ingestion health + pipeline browsing
export async function ingestionHealth(_req: Request, res: Response) {
  const now = new Date();
  const from = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000);
  const activeDoeDocument = await getActiveDoeDocument(now);

  const [
    rawCount,
    rawFailed,
    normalizedCount,
    publishedCount,
    latestLog,
    aiIngestionLog,
    aiSearchLog,
    aiEstimationLog,
    qualityLog,
  ] = await Promise.all([
    RawScrapedSource.countDocuments({}),
    RawScrapedSource.countDocuments({ processingStatus: "failed" }),
    NormalizedFuelRecord.countDocuments(
      activeDoeDocument
        ? {
            sourceType: "official_local",
            sourceUrl: activeDoeDocument.sourceUrl,
            $or: [{ effectiveAt: { $gte: from } }, { sourcePublishedAt: { $gte: from } }],
          }
        : {
            _id: null,
          },
    ),
    FinalPublishedFuelPrice.countDocuments({ updatedAt: { $gte: from } }),
    UpdateLog.findOne({}).sort({ timestamp: -1 }).lean(),
    UpdateLog.findOne({ module: { $in: ["pipeline_run", "ai_ingestion"] } }).sort({ timestamp: -1 }).lean(),
    UpdateLog.findOne({ module: "ai_search_job", timestamp: { $gte: from } }).sort({ timestamp: -1 }).lean(),
    UpdateLog.findOne({ module: "ai_estimation" }).sort({ timestamp: -1 }).lean(),
    UpdateLog.findOne({ module: "data_quality" }).sort({ timestamp: -1 }).lean(),
  ]);

  const formatModuleLog = (log: any) =>
    log
      ? { lastRunAt: log.timestamp, status: log.status, message: log.message }
      : null;
  const aiSearchStatus = {
    lastRunAt: now,
    status: "success",
    message: "Skipped (DOE-only mode).",
  };

  return res.json(
    ok({
      rawCount,
      rawFailed,
      normalizedCount,
      publishedCount,
      latestLog: latestLog ?? null,
      pipelineStatus: {
        aiIngestion: formatModuleLog(aiIngestionLog),
        aiSearch: aiSearchStatus,
        aiEstimation: formatModuleLog(aiEstimationLog),
        dataQuality: formatModuleLog(qualityLog),
      },
      activeDoeDocument,
    }),
  );
}

export async function listRawSources(_req: Request, res: Response) {
  const status = String(_req.query.status ?? "").trim();
  const sourceType = String(_req.query.sourceType ?? "").trim();
  const q: Record<string, unknown> = {};
  if (status) q.processingStatus = status;
  if (sourceType) q.sourceType = sourceType;
  const items = await RawScrapedSource.find(q).sort({ scrapedAt: -1 }).limit(200).lean();
  return res.json(ok({ items }));
}

export async function listNormalizedRecords(_req: Request, res: Response) {
  const now = new Date();
  const from = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000);
  const sourceCategory = String(_req.query.sourceCategory ?? "").trim();
  const fuelType = String(_req.query.fuelType ?? "").trim();
  const q: Record<string, unknown> = {};
  if (sourceCategory) q.sourceCategory = sourceCategory;
  if (fuelType) q.fuelType = fuelType;
  q.$or = [{ effectiveAt: { $gte: from } }, { sourcePublishedAt: { $gte: from } }];
  q.sourceType = "official_local";
  const docs = await NormalizedFuelRecord.find(q).sort({ updatedAt: -1 }).limit(1000).lean();
  const activeDoeDocument = await getActiveDoeDocument(now);
  const items = activeDoeDocument
    ? docs
        .filter((doc: any) => normalizeSourceUrl(String(doc.sourceUrl ?? "")) === normalizeSourceUrl(activeDoeDocument.sourceUrl))
        .slice(0, 200)
    : [];

  return res.json(
    ok({
      items,
      activeDoeDocument,
    }),
  );
}

export async function listPublishedPrices(_req: Request, res: Response) {
  const now = new Date();
  const from = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000);
  const fuelType = String(_req.query.fuelType ?? "").trim();
  const region = String(_req.query.region ?? "").trim();
  const q: Record<string, unknown> = {};
  if (fuelType) q.fuelType = fuelType;
  if (region) q.region = region;
  q.updatedAt = { $gte: from };
  const activeDoeDocument = await getActiveDoeDocument(now);

  const docs = await FinalPublishedFuelPrice.find(q).sort({ updatedAt: -1 }).limit(500).lean();
  const items = activeDoeDocument
    ? docs
        .filter((doc: any) =>
          (doc.supportingSources ?? []).some(
            (src: any) =>
              src.sourceType === "official_local" &&
              normalizeSourceUrl(String(src.sourceUrl ?? "")) === normalizeSourceUrl(activeDoeDocument.sourceUrl),
          ),
        )
        .slice(0, 200)
    : [];

  return res.json(
    ok({
      items,
      activeDoeDocument,
    }),
  );
}

export async function triggerCollectors(_req: Request, res: Response) {
  await collectorsQueue.add("manual_ai_ingest", {}, { jobId: `manual_ai_ingest_${Date.now()}` });
  emitPipelineEvent(
    "pipeline:manual-triggered",
    {
      kind: "ai_ingestion",
      at: new Date().toISOString(),
      by: _req.user?.email ?? "unknown",
    },
    true,
  );
  return res.json(ok({ requested: true, message: "AI ingestion queued." }));
}

export async function triggerAiSearch(_req: Request, res: Response) {
  await collectorsQueue.add("manual_ai_search", {}, { jobId: `manual_ai_search_${Date.now()}` });
  emitPipelineEvent(
    "pipeline:manual-triggered",
    {
      kind: "ai_search",
      at: new Date().toISOString(),
      by: _req.user?.email ?? "unknown",
    },
    true,
  );
  return res.json(ok({ requested: true, message: "Manual AI search queued." }));
}

export async function triggerReconcile(_req: Request, res: Response) {
  return res.json(ok({ requested: false, message: "Rule-based reconciliation is deprecated and disabled." }));
}

export async function triggerQuality(_req: Request, res: Response) {
  await qualityQueue.add("manual_quality", {}, { jobId: `manual_quality_${Date.now()}` });
  return res.json(ok({ requested: true }));
}
