import { model, Schema, type InferSchemaType } from "mongoose";
import { AlertLevelValues } from "./enums";

const AlertSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    level: { type: String, enum: AlertLevelValues, required: true, default: "info", index: true },
    active: { type: Boolean, required: true, default: true, index: true },
    createdAt: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { timestamps: true },
);

AlertSchema.index({ active: 1, createdAt: -1 });

export type AlertDoc = InferSchemaType<typeof AlertSchema>;

export const Alert = model("Alert", AlertSchema);

