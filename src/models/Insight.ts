import { model, Schema, type InferSchemaType } from "mongoose";
import { InsightStatusValues } from "./enums";

const InsightSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    category: { type: String, required: true, trim: true, index: true },
    status: { type: String, enum: InsightStatusValues, required: true, default: "active", index: true },
    createdAt: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { timestamps: true },
);

InsightSchema.index({ status: 1, createdAt: -1 });

export type InsightDoc = InferSchemaType<typeof InsightSchema>;

export const Insight = model("Insight", InsightSchema);

