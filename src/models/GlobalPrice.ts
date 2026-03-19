import { model, Schema, type InferSchemaType } from "mongoose";
import { GlobalPriceTypeValues } from "./enums";

const GlobalPriceSchema = new Schema(
  {
    type: { type: String, enum: GlobalPriceTypeValues, required: true, index: true },
    value: { type: Number, required: true },
    changePercent: { type: Number, required: true },
    timestamp: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

GlobalPriceSchema.index({ type: 1, timestamp: -1 });

export type GlobalPriceDoc = InferSchemaType<typeof GlobalPriceSchema>;

export const GlobalPrice = model("GlobalPrice", GlobalPriceSchema);

