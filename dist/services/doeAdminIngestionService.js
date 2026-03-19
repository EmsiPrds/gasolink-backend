"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDoeRawFromUpload = createDoeRawFromUpload;
exports.createDoeRawFromLink = createDoeRawFromLink;
exports.buildDoePreviewFromRaw = buildDoePreviewFromRaw;
exports.commitDoePreview = commitDoePreview;
const path_1 = __importDefault(require("path"));
const RawScrapedSource_1 = require("../models/RawScrapedSource");
const NormalizedFuelRecord_1 = require("../models/NormalizedFuelRecord");
const UpdateLog_1 = require("../models/UpdateLog");
const pdfTextService_1 = require("./pdfTextService");
const doePdfParser_1 = require("../parsers/doe/doePdfParser");
const httpFetch_1 = require("../scrapers/httpFetch");
const fingerprint_1 = require("../normalization/fingerprint");
const validators_1 = require("../normalization/validators");
async function createDoeRawFromUpload(params) {
    const sourceUrl = `local:${path_1.default.basename(params.originalFilename)}`;
    const textResult = await (0, pdfTextService_1.extractPdfText)({ localPath: params.localPath });
    if (!textResult.ok) {
        await UpdateLog_1.UpdateLog.create({
            module: "admin_doe",
            status: "failure",
            message: `Failed to extract DOE PDF text from upload ${params.originalFilename}: ${textResult.error}`,
            timestamp: new Date(),
        }).catch(() => { });
        throw new Error(textResult.error);
    }
    const raw = await RawScrapedSource_1.RawScrapedSource.create({
        sourceType: "official_local",
        sourceName: "DOE",
        sourceUrl,
        parserId: "doe_pdf_v1",
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
async function createDoeRawFromLink(params) {
    const url = params.url;
    let text = null;
    let finalPdfUrl = url;
    const warnings = [];
    if (url.toLowerCase().endsWith(".pdf")) {
        const textResult = await (0, pdfTextService_1.extractPdfText)({ url });
        if (!textResult.ok) {
            await UpdateLog_1.UpdateLog.create({
                module: "admin_doe",
                status: "failure",
                message: `Failed to extract DOE PDF text from URL ${url}: ${textResult.error}`,
                timestamp: new Date(),
            }).catch(() => { });
            throw new Error(textResult.error);
        }
        text = textResult.text;
    }
    else {
        const fetched = await (0, httpFetch_1.fetchStatic)(url);
        if (fetched.status < 200 || fetched.status >= 300) {
            throw new Error(`HTTP ${fetched.status} for DOE URL ${url}`);
        }
        const htmlBody = fetched.html ?? "";
        const pdfMatch = htmlBody.match(/href=["']([^"']+\.pdf)["']/i);
        if (!pdfMatch) {
            warnings.push("No PDF link found on DOE page; parsed page content directly.");
            text = fetched.text ?? null;
        }
        else {
            finalPdfUrl = new URL(pdfMatch[1], url).toString();
            const textResult = await (0, pdfTextService_1.extractPdfText)({ url: finalPdfUrl });
            if (!textResult.ok) {
                await UpdateLog_1.UpdateLog.create({
                    module: "admin_doe",
                    status: "failure",
                    message: `Failed to extract DOE PDF text from expanded URL ${finalPdfUrl}: ${textResult.error}`,
                    timestamp: new Date(),
                }).catch(() => { });
                throw new Error(textResult.error);
            }
            text = textResult.text;
        }
    }
    const raw = await RawScrapedSource_1.RawScrapedSource.create({
        sourceType: "official_local",
        sourceName: "DOE",
        sourceUrl: finalPdfUrl,
        parserId: "doe_pdf_v1",
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
async function buildDoePreviewFromRaw(rawSourceId, extraWarnings = []) {
    const raw = await RawScrapedSource_1.RawScrapedSource.findById(rawSourceId);
    if (!raw) {
        throw new Error("Raw DOE source not found");
    }
    const parseResult = await doePdfParser_1.doePdfParser.parse(raw);
    if (!parseResult.ok) {
        throw new Error(parseResult.error);
    }
    const rows = [];
    for (const [idx, item] of parseResult.items.entries()) {
        const validated = (0, validators_1.validateCandidate)(item);
        const direction = typeof validated.priceChange === "number"
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
async function commitDoePreview(params) {
    const raw = await RawScrapedSource_1.RawScrapedSource.findById(params.rawSourceId);
    if (!raw) {
        throw new Error("Raw DOE source not found");
    }
    let createdOrUpdated = 0;
    for (const row of params.rows) {
        if (!row.include)
            continue;
        const effectiveAtDate = row.effectiveAt ? new Date(row.effectiveAt) : undefined;
        const validated = (0, validators_1.validateCandidate)({
            sourceType: "official_local",
            statusLabel: "Official",
            confidenceScore: 1,
            companyName: row.companyName,
            stationName: undefined,
            fuelType: row.fuelType,
            productName: undefined,
            region: row.region,
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
        });
        const fingerprint = (0, fingerprint_1.buildFingerprint)({
            sourceUrl: validated.sourceUrl,
            sourcePublishedAt: validated.sourcePublishedAt ? validated.sourcePublishedAt.toISOString() : "",
            fuelType: validated.fuelType,
            region: validated.region,
            city: validated.city ?? "",
            pricePerLiter: validated.pricePerLiter ?? "",
            priceChange: validated.priceChange ?? "",
            effectiveAt: validated.effectiveAt ? validated.effectiveAt.toISOString() : "",
        });
        const existing = await NormalizedFuelRecord_1.NormalizedFuelRecord.findOne({ fingerprint }).lean();
        if (existing) {
            continue;
        }
        await NormalizedFuelRecord_1.NormalizedFuelRecord.updateOne({ fingerprint }, {
            $setOnInsert: {
                ...validated,
                fingerprint,
                rawSourceId: raw._id,
                updatedAt: validated.scrapedAt,
            },
        }, { upsert: true });
        createdOrUpdated += 1;
    }
    raw.processingStatus = "normalized";
    await raw.save();
    await UpdateLog_1.UpdateLog.create({
        module: "admin_doe",
        status: "success",
        message: `DOE admin commit rawSourceId=${raw._id.toString()} createdOrUpdated=${createdOrUpdated}`,
        timestamp: new Date(),
    }).catch(() => { });
    return { ok: true, createdOrUpdated };
}
