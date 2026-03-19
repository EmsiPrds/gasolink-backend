"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDoePdf = uploadDoePdf;
exports.submitDoeLink = submitDoeLink;
exports.previewDoeRaw = previewDoeRaw;
exports.commitDoePreviewEndpoint = commitDoePreviewEndpoint;
exports.listDoeUploads = listDoeUploads;
exports.getDoeUploadDetails = getDoeUploadDetails;
const apiResponse_1 = require("../utils/apiResponse");
const httpStatus_1 = require("../utils/httpStatus");
const doeAdminIngestionService_1 = require("../services/doeAdminIngestionService");
const RawScrapedSource_1 = require("../models/RawScrapedSource");
async function uploadDoePdf(req, res) {
    const file = req.file;
    if (!file) {
        return res.status(httpStatus_1.httpStatus.badRequest).json({ ok: false, error: "Missing PDF file" });
    }
    const note = typeof req.body?.note === "string" ? req.body.note : undefined;
    try {
        console.log("[admin_doe] uploadDoePdf start", {
            adminId: req.user?.sub,
            originalFilename: file.originalname,
            path: file.path,
        });
        const preview = await (0, doeAdminIngestionService_1.createDoeRawFromUpload)({
            adminId: req.user?.sub ?? "unknown",
            localPath: file.path,
            originalFilename: file.originalname,
            note,
        });
        console.log("[admin_doe] uploadDoePdf success", {
            rawSourceId: preview.rawSourceId,
            rows: preview.rows.length,
        });
        return res.status(httpStatus_1.httpStatus.created).json((0, apiResponse_1.ok)(preview));
    }
    catch (err) {
        console.error("[admin_doe] uploadDoePdf error", err);
        const message = err instanceof Error ? err.message : String(err);
        return res
            .status(httpStatus_1.httpStatus.internalServerError)
            .json({ ok: false, error: `Failed to process DOE PDF upload: ${message}` });
    }
}
async function submitDoeLink(req, res) {
    const url = String(req.body?.url ?? "").trim();
    const note = typeof req.body?.note === "string" ? req.body.note : undefined;
    if (!url) {
        return res.status(httpStatus_1.httpStatus.badRequest).json({ ok: false, error: "Missing DOE URL" });
    }
    try {
        console.log("[admin_doe] submitDoeLink start", { adminId: req.user?.sub, url });
        const preview = await (0, doeAdminIngestionService_1.createDoeRawFromLink)({
            adminId: req.user?.sub ?? "unknown",
            url,
            note,
        });
        console.log("[admin_doe] submitDoeLink success", {
            rawSourceId: preview.rawSourceId,
            rows: preview.rows.length,
        });
        return res.status(httpStatus_1.httpStatus.created).json((0, apiResponse_1.ok)(preview));
    }
    catch (err) {
        console.error("[admin_doe] submitDoeLink error", err);
        const message = err instanceof Error ? err.message : String(err);
        return res
            .status(httpStatus_1.httpStatus.internalServerError)
            .json({ ok: false, error: `Failed to process DOE link: ${message}` });
    }
}
async function previewDoeRaw(req, res) {
    const rawSourceId = String(req.params.rawSourceId);
    try {
        console.log("[admin_doe] previewDoeRaw", { rawSourceId });
        const preview = await (0, doeAdminIngestionService_1.buildDoePreviewFromRaw)(rawSourceId);
        return res.json((0, apiResponse_1.ok)(preview));
    }
    catch (err) {
        console.error("[admin_doe] previewDoeRaw error", err);
        const message = err instanceof Error ? err.message : String(err);
        return res
            .status(httpStatus_1.httpStatus.internalServerError)
            .json({ ok: false, error: `Failed to build DOE preview: ${message}` });
    }
}
async function commitDoePreviewEndpoint(req, res) {
    const rawSourceId = String(req.params.rawSourceId);
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    try {
        console.log("[admin_doe] commitDoePreview start", { rawSourceId, rows: rows.length });
        const result = await (0, doeAdminIngestionService_1.commitDoePreview)({ rawSourceId, rows });
        console.log("[admin_doe] commitDoePreview success", result);
        return res.json((0, apiResponse_1.ok)(result));
    }
    catch (err) {
        console.error("[admin_doe] commitDoePreview error", err);
        const message = err instanceof Error ? err.message : String(err);
        return res
            .status(httpStatus_1.httpStatus.internalServerError)
            .json({ ok: false, error: `Failed to commit DOE preview: ${message}` });
    }
}
async function listDoeUploads(_req, res) {
    const items = await RawScrapedSource_1.RawScrapedSource.find({
        isManualAdminSource: true,
        sourceName: "DOE",
    })
        .sort({ scrapedAt: -1 })
        .limit(200)
        .lean();
    return res.json((0, apiResponse_1.ok)({ items }));
}
async function getDoeUploadDetails(req, res) {
    const rawSourceId = String(req.params.rawSourceId);
    const item = await RawScrapedSource_1.RawScrapedSource.findById(rawSourceId).lean();
    if (!item) {
        return res.status(httpStatus_1.httpStatus.notFound).json({ ok: false, error: "DOE upload not found" });
    }
    const preview = await (0, doeAdminIngestionService_1.buildDoePreviewFromRaw)(rawSourceId).catch(() => null);
    return res.json((0, apiResponse_1.ok)({ item, preview }));
}
