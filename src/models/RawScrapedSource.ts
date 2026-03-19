import { model, Schema, type InferSchemaType } from "mongoose";
import { ProcessingStatusValues, SourceTypeValues } from "./enums";

const RawScrapedSourceSchema = new Schema(
  {
    sourceType: { type: String, enum: SourceTypeValues, required: true, index: true },
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
      enum: ProcessingStatusValues,
      required: true,
      default: "raw",
      index: true,
    },
    errorMessage: { type: String },

    // Optional context for admin-triggered manual uploads (e.g. DOE PDFs/links)
    isManualAdminSource: { type: Boolean, default: false, index: true },
    uploadContext: {
      uploadedBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
      uploadType: { type: String, enum: ["file", "link"] },
      originalFilename: { type: String, trim: true },
      originalUrl: { type: String, trim: true },
      note: { type: String, trim: true },
    },
  },
  { timestamps: true },
);

// Avoid duplicating identical snapshots for the same source+parser+time bucket.
RawScrapedSourceSchema.index({ sourceUrl: 1, scrapedAt: -1 });
RawScrapedSourceSchema.index({ parserId: 1, scrapedAt: -1 });

export type RawScrapedSourceDoc = InferSchemaType<typeof RawScrapedSourceSchema>;

export const RawScrapedSource = model("RawScrapedSource", RawScrapedSourceSchema);

