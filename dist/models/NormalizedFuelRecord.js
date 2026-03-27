"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NormalizedFuelRecord = void 0;
const mongoose_1 = require("mongoose");
const enums_1 = require("./enums");
const SupportingSourceSchema = new mongoose_1.Schema({
    sourceName: { type: String, required: true, trim: true },
    sourceUrl: { type: String, required: true, trim: true },
    sourceType: { type: String, enum: enums_1.SourceTypeValues, required: true },
    sourcePublishedAt: { type: Date },
    scrapedAt: { type: Date, required: true },
    parserVersion: { type: String, required: true },
}, { _id: false });
const SourceCategoryValues = ["global_api", "doe_official", "web_scrape", "user_report"];
const NormalizedFuelRecordSchema = new mongoose_1.Schema({
    sourceType: { type: String, enum: enums_1.SourceTypeValues, required: true, index: true },
    sourceCategory: { type: String, enum: SourceCategoryValues, required: true, index: true, default: "web_scrape" },
    statusLabel: { type: String, enum: enums_1.StatusLabelValues, required: true, index: true },
    confidenceScore: { type: Number, required: true, min: 0, max: 1, index: true },
    companyName: { type: String, trim: true, index: true },
    stationName: { type: String, trim: true, index: true },
    fuelType: { type: String, enum: enums_1.FuelTypeValues, required: true, index: true },
    productName: { type: String, trim: true },
    region: { type: String, enum: enums_1.RegionValues, required: true, index: true },
    city: { type: String, trim: true, index: true },
    // For observed station prices: pricePerLiter is the actual value.
    // For advisory sources: priceChange is used (delta), pricePerLiter may be omitted.
    pricePerLiter: { type: Number, min: 0 },
    priceChange: { type: Number },
    currency: { type: String, required: true, default: "PHP" },
    sourceName: { type: String, required: true, trim: true, index: true },
    sourceUrl: { type: String, required: true, trim: true, index: true },
    sourcePublishedAt: { type: Date },
    scrapedAt: { type: Date, required: true, default: () => new Date(), index: true },
    effectiveAt: { type: Date, index: true },
    // Dedupe: hash/fingerprint of normalized content + source identity.
    fingerprint: { type: String, required: true, index: true, unique: true },
    // Optional: reference to raw snapshot used (not enforced as ObjectId to keep ingestion flexible)
    rawSourceId: { type: mongoose_1.Schema.Types.ObjectId, ref: "RawScrapedSource", index: true },
    supportingSources: { type: [SupportingSourceSchema], default: [] },
}, { timestamps: true });
NormalizedFuelRecordSchema.index({ fuelType: 1, region: 1, city: 1, effectiveAt: -1, confidenceScore: -1 });
NormalizedFuelRecordSchema.index({ sourceType: 1, scrapedAt: -1 });
exports.NormalizedFuelRecord = (0, mongoose_1.model)("NormalizedFuelRecord", NormalizedFuelRecordSchema);
