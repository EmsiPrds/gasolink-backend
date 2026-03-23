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
import { runAiSearchDataGathering } from "../jobs/aiSearchJob";
import { collectorsQueue, qualityQueue, reconcileQueue } from "../queue/queues";
import {
  AdminAlertBodySchema,
  AdminCompanyPriceBodySchema,
  AdminInsightBodySchema,
  AdminLogsQuerySchema,
  AdminPhPriceBodySchema,
  IdParamSchema,
} from "../validators/adminValidators";

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
  const [
    rawCount,
    rawFailed,
    normalizedCount,
    publishedCount,
    latestLog,
    collectorsLog,
    reconcileLog,
    qualityLog,
  ] = await Promise.all([
    RawScrapedSource.countDocuments({}),
    RawScrapedSource.countDocuments({ processingStatus: "failed" }),
    NormalizedFuelRecord.countDocuments({}),
    FinalPublishedFuelPrice.countDocuments({}),
    UpdateLog.findOne({}).sort({ timestamp: -1 }).lean(),
    UpdateLog.findOne({ module: "collectors" }).sort({ timestamp: -1 }).lean(),
    UpdateLog.findOne({ module: "reconciliation" }).sort({ timestamp: -1 }).lean(),
    UpdateLog.findOne({ module: "data_quality" }).sort({ timestamp: -1 }).lean(),
  ]);

  const formatModuleLog = (log: any) =>
    log
      ? { lastRunAt: log.timestamp, status: log.status, message: log.message }
      : null;

  return res.json(
    ok({
      rawCount,
      rawFailed,
      normalizedCount,
      publishedCount,
      latestLog: latestLog ?? null,
      pipelineStatus: {
        collectors: formatModuleLog(collectorsLog),
        reconciliation: formatModuleLog(reconcileLog),
        dataQuality: formatModuleLog(qualityLog),
      },
    }),
  );
}

export async function listRawSources(_req: Request, res: Response) {
  const status = String(_req.query.status ?? "").trim();
  const q: Record<string, unknown> = {};
  if (status) q.processingStatus = status;
  const items = await RawScrapedSource.find(q).sort({ scrapedAt: -1 }).limit(200).lean();
  return res.json(ok({ items }));
}

export async function listNormalizedRecords(_req: Request, res: Response) {
  const items = await NormalizedFuelRecord.find({}).sort({ updatedAt: -1 }).limit(200).lean();
  return res.json(ok({ items }));
}

export async function listPublishedPrices(_req: Request, res: Response) {
  const items = await FinalPublishedFuelPrice.find({}).sort({ updatedAt: -1 }).limit(200).lean();
  return res.json(ok({ items }));
}

export async function triggerCollectors(_req: Request, res: Response) {
  // Instead of traditional collectors, we trigger the AI search gathering.
  runAiSearchDataGathering().catch((err) => console.error("Manual AI search trigger failed:", err));
  return res.json(ok({ requested: true, message: "AI search data gathering triggered." }));
}

export async function triggerReconcile(_req: Request, res: Response) {
  await reconcileQueue.add("manual_reconcile", {}, { jobId: `manual_reconcile_${Date.now()}` });
  return res.json(ok({ requested: true }));
}

export async function triggerQuality(_req: Request, res: Response) {
  await qualityQueue.add("manual_quality", {}, { jobId: `manual_quality_${Date.now()}` });
  return res.json(ok({ requested: true }));
}

