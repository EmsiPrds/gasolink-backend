import { model, Schema, type InferSchemaType } from "mongoose";
import { FuelTypeValues, PriceStatusValues, RegionValues } from "./enums";

const FuelPricePHSchema = new Schema(
  {
    fuelType: { type: String, enum: FuelTypeValues, required: true, index: true },
    price: { type: Number, required: true },
    weeklyChange: { type: Number, required: true },
    region: { type: String, enum: RegionValues, required: true, index: true },
    source: { type: String, required: true },
    status: { type: String, enum: PriceStatusValues, required: true, index: true },
    updatedAt: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { timestamps: true },
);

FuelPricePHSchema.index({ region: 1, fuelType: 1, updatedAt: -1 });

export type FuelPricePHDoc = InferSchemaType<typeof FuelPricePHSchema>;

export const FuelPricePH = model("FuelPricePH", FuelPricePHSchema);

