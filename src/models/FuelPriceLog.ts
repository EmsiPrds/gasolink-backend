import mongoose, { Schema, Document } from "mongoose";
import { FuelTypeValues } from "./enums";

export interface IFuelPriceLog extends Document {
  stationId: mongoose.Types.ObjectId;
  fuelType: string;
  price: number;
  source: "SCRAPER" | "USER";
  reportedBy?: mongoose.Types.ObjectId;
  aiConfidenceScore: number;
  isOutlier: boolean;
  aiReasoning?: string;
  locationName?: string;
  reportedAt: Date;
}

const FuelPriceLogSchema: Schema = new Schema(
  {
    stationId: { type: Schema.Types.ObjectId, ref: "Station", required: true },
    fuelType: { type: String, enum: FuelTypeValues, required: true },
    price: { type: Number, required: true },
    source: { type: String, enum: ["SCRAPER", "USER"], required: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: "User" },
    aiConfidenceScore: { type: Number, default: 0 }, // 0 to 100
    isOutlier: { type: Boolean, default: false },
    aiReasoning: { type: String },
    locationName: { type: String },
    reportedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

FuelPriceLogSchema.index({ stationId: 1, fuelType: 1, reportedAt: -1 });

export default mongoose.models.FuelPriceLog || mongoose.model<IFuelPriceLog>("FuelPriceLog", FuelPriceLogSchema);
