"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RawScrapedSource = void 0;
const mongoose_1 = require("mongoose");
const enums_1 = require("./enums");
const RawScrapedSourceSchema = new mongoose_1.Schema({
    sourceType: { type: String, enum: enums_1.SourceTypeValues, required: true, index: true },
    sourceName: { type: String, required: true, trim: true, index: true },
    sourceUrl: { type: String, required: true, trim: true, index: true },
    parserId: { type: String, required: true, trim: true, index: true },
    // Audit snapshot (store at least one of these per run)
    rawHtml: { type: String },
    rawText: { type: String },
    rawFilePath: { type: String, trim: true },
    scrapedAt: { type: Date, required: true, default: () => new Date(), index: true },
    parserVersion: { type: String, required: true, default: "v1", index: true },
    processingStatus: {
        type: String,
        enum: enums_1.ProcessingStatusValues,
        required: true,
        default: "raw",
        index: true,
    },
    errorMessage: { type: String },
    // Optional context for admin-triggered manual uploads (e.g. DOE PDFs/links)
    isManualAdminSource: { type: Boolean, default: false, index: true },
    uploadContext: {
        uploadedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "AdminUser" },
        uploadType: { type: String, enum: ["file", "link"] },
        originalFilename: { type: String, trim: true },
        originalUrl: { type: String, trim: true },
        note: { type: String, trim: true },
    },
}, { timestamps: true });
// Avoid duplicating identical snapshots for the same source+parser+time bucket.
RawScrapedSourceSchema.index({ sourceUrl: 1, scrapedAt: -1 });
RawScrapedSourceSchema.index({ parserId: 1, scrapedAt: -1 });
exports.RawScrapedSource = (0, mongoose_1.model)("RawScrapedSource", RawScrapedSourceSchema);
