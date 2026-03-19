"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyPrice = void 0;
const mongoose_1 = require("mongoose");
const enums_1 = require("./enums");
const CompanyPriceSchema = new mongoose_1.Schema({
    companyName: { type: String, required: true, trim: true, index: true },
    fuelType: { type: String, enum: enums_1.FuelTypeValues, required: true, index: true },
    price: { type: Number, required: true },
    region: { type: String, enum: enums_1.RegionValues, required: true, index: true },
    city: { type: String, trim: true },
    status: { type: String, enum: enums_1.PriceStatusValues, required: true, index: true },
    source: { type: String, required: true },
    verifiedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "AdminUser" },
    updatedAt: { type: Date, required: true, default: () => new Date(), index: true },
}, { timestamps: true });
CompanyPriceSchema.index({ region: 1, fuelType: 1, companyName: 1, updatedAt: -1 });
exports.CompanyPrice = (0, mongoose_1.model)("CompanyPrice", CompanyPriceSchema);
