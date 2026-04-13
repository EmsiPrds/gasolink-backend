"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminSummary = adminSummary;
exports.listPhPrices = listPhPrices;
exports.createPhPrice = createPhPrice;
exports.updatePhPrice = updatePhPrice;
exports.deletePhPrice = deletePhPrice;
exports.listCompanyPrices = listCompanyPrices;
exports.createCompanyPrice = createCompanyPrice;
exports.updateCompanyPrice = updateCompanyPrice;
exports.deleteCompanyPrice = deleteCompanyPrice;
exports.listInsights = listInsights;
exports.createInsight = createInsight;
exports.updateInsight = updateInsight;
exports.deleteInsight = deleteInsight;
exports.listAlerts = listAlerts;
exports.createAlert = createAlert;
exports.updateAlert = updateAlert;
exports.deleteAlert = deleteAlert;
exports.listLogs = listLogs;
exports.refreshGlobalNow = refreshGlobalNow;
exports.ingestionHealth = ingestionHealth;
exports.listRawSources = listRawSources;
exports.listNormalizedRecords = listNormalizedRecords;
exports.listPublishedPrices = listPublishedPrices;
exports.triggerCollectors = triggerCollectors;
exports.triggerAiSearch = triggerAiSearch;
exports.triggerReconcile = triggerReconcile;
exports.triggerQuality = triggerQuality;
const apiResponse_1 = require("../utils/apiResponse");
const httpStatus_1 = require("../utils/httpStatus");
const FuelPricePH_1 = require("../models/FuelPricePH");
const CompanyPrice_1 = require("../models/CompanyPrice");
const Insight_1 = require("../models/Insight");
const Alert_1 = require("../models/Alert");
const UpdateLog_1 = require("../models/UpdateLog");
const RawScrapedSource_1 = require("../models/RawScrapedSource");
const NormalizedFuelRecord_1 = require("../models/NormalizedFuelRecord");
const FinalPublishedFuelPrice_1 = require("../models/FinalPublishedFuelPrice");
const globalPriceService_1 = require("../services/globalPriceService");
const MockGlobalPriceProvider_1 = require("../services/providers/MockGlobalPriceProvider");
const queues_1 = require("../queue/queues");
const socketServer_1 = require("../realtime/socketServer");
const adminValidators_1 = require("../validators/adminValidators");
const doeLatestPolicy_1 = require("../utils/doeLatestPolicy");
const MAX_DOE_DOC_AGE_DAYS = 14;
async function getActiveDoeDocument(now) {
    const from = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000);
    const raw = await RawScrapedSource_1.RawScrapedSource.findOne({
        sourceType: "official_local",
        aiSelectedLatest: true,
        aiDocumentDate: { $gte: from, $lte: now },
    })
        .sort({ aiDocumentDate: -1, scrapedAt: -1 })
        .select({ sourceUrl: 1, aiDocumentDate: 1, aiConfidence: 1, aiReason: 1 })
        .lean();
    if (!raw?.sourceUrl || !raw.aiDocumentDate)
        return null;
    return {
        sourceUrl: String(raw.sourceUrl),
        documentDate: new Date(raw.aiDocumentDate).toISOString(),
        confidence: typeof raw.aiConfidence === "number" ? raw.aiConfidence : undefined,
        reason: typeof raw.aiReason === "string" ? raw.aiReason : undefined,
    };
}
async function adminSummary(_req, res) {
    const [phCount, companyCount, insightsCount, alertsCount] = await Promise.all([
        FuelPricePH_1.FuelPricePH.countDocuments({}),
        CompanyPrice_1.CompanyPrice.countDocuments({}),
        Insight_1.Insight.countDocuments({}),
        Alert_1.Alert.countDocuments({}),
    ]);
    return res.json((0, apiResponse_1.ok)({ phCount, companyCount, insightsCount, alertsCount }));
}
// PH prices
async function listPhPrices(_req, res) {
    const items = await FuelPricePH_1.FuelPricePH.find({}).sort({ updatedAt: -1 }).limit(500).lean();
    return res.json((0, apiResponse_1.ok)({ items }));
}
async function createPhPrice(req, res) {
    const body = adminValidators_1.AdminPhPriceBodySchema.parse(req.body);
    const created = await FuelPricePH_1.FuelPricePH.create({
        ...body,
        updatedAt: body.updatedAt ?? new Date(),
    });
    return res.status(httpStatus_1.httpStatus.created).json((0, apiResponse_1.ok)({ item: created }));
}
async function updatePhPrice(req, res) {
    const { id } = adminValidators_1.IdParamSchema.parse(req.params);
    const body = adminValidators_1.AdminPhPriceBodySchema.partial().parse(req.body);
    const updated = await FuelPricePH_1.FuelPricePH.findByIdAndUpdate(id, { ...body, ...(body.updatedAt ? { updatedAt: body.updatedAt } : {}) }, { new: true }).lean();
    return res.json((0, apiResponse_1.ok)({ item: updated }));
}
async function deletePhPrice(req, res) {
    const { id } = adminValidators_1.IdParamSchema.parse(req.params);
    await FuelPricePH_1.FuelPricePH.findByIdAndDelete(id);
    return res.json((0, apiResponse_1.ok)({ deleted: true }));
}
// Company prices
async function listCompanyPrices(_req, res) {
    const items = await CompanyPrice_1.CompanyPrice.find({}).sort({ updatedAt: -1 }).limit(500).lean();
    return res.json((0, apiResponse_1.ok)({ items }));
}
async function createCompanyPrice(req, res) {
    const body = adminValidators_1.AdminCompanyPriceBodySchema.parse(req.body);
    const created = await CompanyPrice_1.CompanyPrice.create({
        ...body,
        verifiedBy: body.status === "Verified" ? req.user?.sub : undefined,
        updatedAt: body.updatedAt ?? new Date(),
    });
    return res.status(httpStatus_1.httpStatus.created).json((0, apiResponse_1.ok)({ item: created }));
}
async function updateCompanyPrice(req, res) {
    const { id } = adminValidators_1.IdParamSchema.parse(req.params);
    const body = adminValidators_1.AdminCompanyPriceBodySchema.partial().parse(req.body);
    const patch = { ...body };
    if (body.status === "Verified")
        patch.verifiedBy = req.user?.sub;
    const updated = await CompanyPrice_1.CompanyPrice.findByIdAndUpdate(id, patch, { new: true }).lean();
    return res.json((0, apiResponse_1.ok)({ item: updated }));
}
async function deleteCompanyPrice(req, res) {
    const { id } = adminValidators_1.IdParamSchema.parse(req.params);
    await CompanyPrice_1.CompanyPrice.findByIdAndDelete(id);
    return res.json((0, apiResponse_1.ok)({ deleted: true }));
}
// Insights
async function listInsights(_req, res) {
    const items = await Insight_1.Insight.find({}).sort({ createdAt: -1 }).limit(500).lean();
    return res.json((0, apiResponse_1.ok)({ items }));
}
async function createInsight(req, res) {
    const body = adminValidators_1.AdminInsightBodySchema.parse(req.body);
    const created = await Insight_1.Insight.create({
        ...body,
        status: body.status ?? "active",
        createdAt: new Date(),
    });
    return res.status(httpStatus_1.httpStatus.created).json((0, apiResponse_1.ok)({ item: created }));
}
async function updateInsight(req, res) {
    const { id } = adminValidators_1.IdParamSchema.parse(req.params);
    const body = adminValidators_1.AdminInsightBodySchema.partial().parse(req.body);
    const updated = await Insight_1.Insight.findByIdAndUpdate(id, body, { new: true }).lean();
    return res.json((0, apiResponse_1.ok)({ item: updated }));
}
async function deleteInsight(req, res) {
    const { id } = adminValidators_1.IdParamSchema.parse(req.params);
    await Insight_1.Insight.findByIdAndDelete(id);
    return res.json((0, apiResponse_1.ok)({ deleted: true }));
}
// Alerts
async function listAlerts(_req, res) {
    const items = await Alert_1.Alert.find({}).sort({ createdAt: -1 }).limit(500).lean();
    return res.json((0, apiResponse_1.ok)({ items }));
}
async function createAlert(req, res) {
    const body = adminValidators_1.AdminAlertBodySchema.parse(req.body);
    const created = await Alert_1.Alert.create({
        ...body,
        level: body.level ?? "info",
        active: body.active ?? true,
        createdAt: new Date(),
    });
    return res.status(httpStatus_1.httpStatus.created).json((0, apiResponse_1.ok)({ item: created }));
}
async function updateAlert(req, res) {
    const { id } = adminValidators_1.IdParamSchema.parse(req.params);
    const body = adminValidators_1.AdminAlertBodySchema.partial().parse(req.body);
    const updated = await Alert_1.Alert.findByIdAndUpdate(id, body, { new: true }).lean();
    return res.json((0, apiResponse_1.ok)({ item: updated }));
}
async function deleteAlert(req, res) {
    const { id } = adminValidators_1.IdParamSchema.parse(req.params);
    await Alert_1.Alert.findByIdAndDelete(id);
    return res.json((0, apiResponse_1.ok)({ deleted: true }));
}
// Logs
async function listLogs(req, res) {
    const { module, status } = adminValidators_1.AdminLogsQuerySchema.parse(req.query);
    const q = {};
    if (module)
        q.module = module;
    if (status)
        q.status = status;
    const items = await UpdateLog_1.UpdateLog.find(q).sort({ timestamp: -1 }).limit(500).lean();
    return res.json((0, apiResponse_1.ok)({ items }));
}
// Manual refresh placeholder (real implementation wired in cron todo)
async function refreshGlobalNow(_req, res) {
    const provider = new MockGlobalPriceProvider_1.MockGlobalPriceProvider();
    const result = await (0, globalPriceService_1.refreshGlobalPrices)(provider, { trigger: "manual" });
    return res.json((0, apiResponse_1.ok)({ requested: true, ok: result.ok }));
}
// Ingestion health + pipeline browsing
async function ingestionHealth(_req, res) {
    const now = new Date();
    const from = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000);
    const activeDoeDocument = await getActiveDoeDocument(now);
    const [rawCount, rawFailed, normalizedCount, publishedCount, latestLog, aiIngestionLog, aiSearchLog, aiEstimationLog, qualityLog,] = await Promise.all([
        RawScrapedSource_1.RawScrapedSource.countDocuments({}),
        RawScrapedSource_1.RawScrapedSource.countDocuments({ processingStatus: "failed" }),
        NormalizedFuelRecord_1.NormalizedFuelRecord.countDocuments(activeDoeDocument
            ? {
                sourceType: "official_local",
                sourceUrl: activeDoeDocument.sourceUrl,
                $or: [{ effectiveAt: { $gte: from } }, { sourcePublishedAt: { $gte: from } }],
            }
            : {
                _id: null,
            }),
        FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.countDocuments({ updatedAt: { $gte: from } }),
        UpdateLog_1.UpdateLog.findOne({}).sort({ timestamp: -1 }).lean(),
        UpdateLog_1.UpdateLog.findOne({ module: { $in: ["pipeline_run", "ai_ingestion"] } }).sort({ timestamp: -1 }).lean(),
        UpdateLog_1.UpdateLog.findOne({ module: "ai_search_job", timestamp: { $gte: from } }).sort({ timestamp: -1 }).lean(),
        UpdateLog_1.UpdateLog.findOne({ module: "ai_estimation" }).sort({ timestamp: -1 }).lean(),
        UpdateLog_1.UpdateLog.findOne({ module: "data_quality" }).sort({ timestamp: -1 }).lean(),
    ]);
    const formatModuleLog = (log) => log
        ? { lastRunAt: log.timestamp, status: log.status, message: log.message }
        : null;
    const aiSearchStatus = {
        lastRunAt: now,
        status: "success",
        message: "Skipped (DOE-only mode).",
    };
    return res.json((0, apiResponse_1.ok)({
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
    }));
}
async function listRawSources(_req, res) {
    const status = String(_req.query.status ?? "").trim();
    const sourceType = String(_req.query.sourceType ?? "").trim();
    const q = {};
    if (status)
        q.processingStatus = status;
    if (sourceType)
        q.sourceType = sourceType;
    const items = await RawScrapedSource_1.RawScrapedSource.find(q).sort({ scrapedAt: -1 }).limit(200).lean();
    return res.json((0, apiResponse_1.ok)({ items }));
}
async function listNormalizedRecords(_req, res) {
    const now = new Date();
    const from = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000);
    const sourceCategory = String(_req.query.sourceCategory ?? "").trim();
    const fuelType = String(_req.query.fuelType ?? "").trim();
    const q = {};
    if (sourceCategory)
        q.sourceCategory = sourceCategory;
    if (fuelType)
        q.fuelType = fuelType;
    q.$or = [{ effectiveAt: { $gte: from } }, { sourcePublishedAt: { $gte: from } }];
    q.sourceType = "official_local";
    const docs = await NormalizedFuelRecord_1.NormalizedFuelRecord.find(q).sort({ updatedAt: -1 }).limit(1000).lean();
    const activeDoeDocument = await getActiveDoeDocument(now);
    const items = activeDoeDocument
        ? docs
            .filter((doc) => (0, doeLatestPolicy_1.normalizeSourceUrl)(String(doc.sourceUrl ?? "")) === (0, doeLatestPolicy_1.normalizeSourceUrl)(activeDoeDocument.sourceUrl))
            .slice(0, 200)
        : [];
    return res.json((0, apiResponse_1.ok)({
        items,
        activeDoeDocument,
    }));
}
async function listPublishedPrices(_req, res) {
    const now = new Date();
    const from = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000);
    const fuelType = String(_req.query.fuelType ?? "").trim();
    const region = String(_req.query.region ?? "").trim();
    const q = {};
    if (fuelType)
        q.fuelType = fuelType;
    if (region)
        q.region = region;
    q.updatedAt = { $gte: from };
    const activeDoeDocument = await getActiveDoeDocument(now);
    const docs = await FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.find(q).sort({ updatedAt: -1 }).limit(500).lean();
    const items = activeDoeDocument
        ? docs
            .filter((doc) => (doc.supportingSources ?? []).some((src) => src.sourceType === "official_local" &&
            (0, doeLatestPolicy_1.normalizeSourceUrl)(String(src.sourceUrl ?? "")) === (0, doeLatestPolicy_1.normalizeSourceUrl)(activeDoeDocument.sourceUrl)))
            .slice(0, 200)
        : [];
    return res.json((0, apiResponse_1.ok)({
        items,
        activeDoeDocument,
    }));
}
async function triggerCollectors(_req, res) {
    await queues_1.collectorsQueue.add("manual_doe_ingest", {}, { jobId: `manual_doe_ingest_${Date.now()}` });
    (0, socketServer_1.emitPipelineEvent)("pipeline:manual-triggered", {
        kind: "manual_doe_ingestion",
        at: new Date().toISOString(),
        by: _req.user?.email ?? "unknown",
    }, true);
    return res.json((0, apiResponse_1.ok)({ requested: true, message: "Manual DOE ingestion/publish queued." }));
}
async function triggerAiSearch(_req, res) {
    return res.json((0, apiResponse_1.ok)({ requested: false, message: "AI search scraping is disabled. Use DOE manual upload flow." }));
}
async function triggerReconcile(_req, res) {
    return res.json((0, apiResponse_1.ok)({ requested: false, message: "Rule-based reconciliation is deprecated and disabled." }));
}
async function triggerQuality(_req, res) {
    await queues_1.qualityQueue.add("manual_quality", {}, { jobId: `manual_quality_${Date.now()}` });
    return res.json((0, apiResponse_1.ok)({ requested: true }));
}
