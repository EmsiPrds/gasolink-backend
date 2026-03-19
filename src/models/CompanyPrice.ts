import { model, Schema, type InferSchemaType, type Types } from "mongoose";
import { FuelTypeValues, PriceStatusValues, RegionValues } from "./enums";

const CompanyPriceSchema = new Schema(
  {
    companyName: { type: String, required: true, trim: true, index: true },
    fuelType: { type: String, enum: FuelTypeValues, required: true, index: true },
    price: { type: Number, required: true },
    region: { type: String, enum: RegionValues, required: true, index: true },
    city: { type: String, trim: true },
    status: { type: String, enum: PriceStatusValues, required: true, index: true },
    source: { type: String, required: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    updatedAt: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { timestamps: true },
);

CompanyPriceSchema.index({ region: 1, fuelType: 1, companyName: 1, updatedAt: -1 });

export type CompanyPriceDoc = Omit<InferSchemaType<typeof CompanyPriceSchema>, "verifiedBy"> & {
  verifiedBy?: Types.ObjectId;
};

export const CompanyPrice = model("CompanyPrice", CompanyPriceSchema);

