import { model, Schema, type InferSchemaType } from "mongoose";
import { FuelTypeValues, RegionValues, SourceTypeValues, StatusLabelValues } from "./enums";

const SupportingSourceSchema = new Schema(
  {
    sourceName: { type: String, required: true, trim: true },
    sourceUrl: { type: String, required: true, trim: true },
    sourceType: { type: String, enum: SourceTypeValues, required: true },
    sourcePublishedAt: { type: Date },
    scrapedAt: { type: Date, required: true },
    parserVersion: { type: String, required: true },
  },
  { _id: false },
);

const NormalizedFuelRecordSchema = new Schema(
  {
    sourceType: { type: String, enum: SourceTypeValues, required: true, index: true },
    statusLabel: { type: String, enum: StatusLabelValues, required: true, index: true },
    confidenceScore: { type: Number, required: true, min: 0, max: 1, index: true },

    companyName: { type: String, trim: true, index: true },
    stationName: { type: String, trim: true, index: true },
    fuelType: { type: String, enum: FuelTypeValues, required: true, index: true },
    productName: { type: String, trim: true },

    region: { type: String, enum: RegionValues, required: true, index: true },
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
    updatedAt: { type: Date, required: true, default: () => new Date(), index: true },

    // Dedupe: hash/fingerprint of normalized content + source identity.
    fingerprint: { type: String, required: true, index: true, unique: true },

    // Optional: reference to raw snapshot used (not enforced as ObjectId to keep ingestion flexible)
    rawSourceId: { type: Schema.Types.ObjectId, ref: "RawScrapedSource", index: true },

    supportingSources: { type: [SupportingSourceSchema], default: [] },
  },
  { timestamps: true },
);

NormalizedFuelRecordSchema.index({ fuelType: 1, region: 1, city: 1, effectiveAt: -1, confidenceScore: -1 });
NormalizedFuelRecordSchema.index({ sourceType: 1, scrapedAt: -1 });

export type NormalizedFuelRecordDoc = InferSchemaType<typeof NormalizedFuelRecordSchema>;

export const NormalizedFuelRecord = model("NormalizedFuelRecord", NormalizedFuelRecordSchema);

