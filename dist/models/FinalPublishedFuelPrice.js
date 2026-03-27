"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinalPublishedFuelPrice = void 0;
const mongoose_1 = require("mongoose");
const enums_1 = require("./enums");
const PublishedSupportingSourceSchema = new mongoose_1.Schema({
    normalizedRecordId: { type: mongoose_1.Schema.Types.ObjectId, ref: "NormalizedFuelRecord" },
    sourceType: { type: String, enum: enums_1.SourceTypeValues, required: true },
    sourceName: { type: String, required: true, trim: true },
    sourceUrl: { type: String, required: true, trim: true },
    sourcePublishedAt: { type: Date },
    scrapedAt: { type: Date, required: true },
    parserVersion: { type: String, required: true },
    confidenceScore: { type: Number, required: true, min: 0, max: 1 },
    statusLabel: { type: String, enum: enums_1.StatusLabelValues, required: true },
}, { _id: false });
const SourceBreakdownSchema = new mongoose_1.Schema({
    sourceCategory: { type: String, required: true, trim: true },
    sampleSize: { type: Number, required: true, min: 0 },
    avgConfidence: { type: Number, required: true, min: 0, max: 1 },
    avgPrice: { type: Number, min: 0 },
    freshnessHours: { type: Number, min: 0 },
}, { _id: false });
const FinalPublishedFuelPriceSchema = new mongoose_1.Schema({
    // displayType can be used to separate "official_latest" vs "observed" vs "advisory_delta"
    displayType: { type: String, required: true, default: "ph_final", index: true },
    companyName: { type: String, trim: true, index: true },
    fuelType: { type: String, enum: enums_1.FuelTypeValues, required: true, index: true },
    region: { type: String, enum: enums_1.RegionValues, required: true, index: true },
    city: { type: String, trim: true, index: true },
    // Final value users see. For advisory-only entries, this may be null (delta only),
    // but we still publish a record with a clear finalStatus.
    finalPrice: { type: Number, min: 0 },
    averagePrice: { type: Number, min: 0 },
    priceChange: { type: Number },
    currency: { type: String, required: true, default: "PHP" },
    supportingSources: { type: [PublishedSupportingSourceSchema], required: true, default: [] },
    finalStatus: { type: String, enum: enums_1.StatusLabelValues, required: true, index: true },
    confidenceScore: { type: Number, required: true, min: 0, max: 1, index: true },
    confidenceLabel: { type: String, required: true, default: "Low", index: true },
    estimateExplanation: { type: String, required: true, default: "" },
    sourceBreakdown: { type: [SourceBreakdownSchema], required: true, default: [] },
    lastVerifiedAt: { type: Date, required: true, index: true },
    updatedAt: { type: Date, required: true, default: () => new Date(), index: true },
    // For dedupe / upsert
    publishKey: { type: String, required: true, unique: true, index: true },
}, { timestamps: true });
FinalPublishedFuelPriceSchema.index({ fuelType: 1, region: 1, city: 1, updatedAt: -1 });
FinalPublishedFuelPriceSchema.index({ finalStatus: 1, confidenceScore: -1, lastVerifiedAt: -1 });
exports.FinalPublishedFuelPrice = (0, mongoose_1.model)("FinalPublishedFuelPrice", FinalPublishedFuelPriceSchema);
