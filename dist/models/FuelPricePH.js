"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FuelPricePH = void 0;
const mongoose_1 = require("mongoose");
const enums_1 = require("./enums");
const FuelPricePHSchema = new mongoose_1.Schema({
    fuelType: { type: String, enum: enums_1.FuelTypeValues, required: true, index: true },
    price: { type: Number, required: true },
    weeklyChange: { type: Number, required: true },
    region: { type: String, enum: enums_1.RegionValues, required: true, index: true },
    source: { type: String, required: true },
    status: { type: String, enum: enums_1.PriceStatusValues, required: true, index: true },
    updatedAt: { type: Date, required: true, default: () => new Date(), index: true },
}, { timestamps: true });
FuelPricePHSchema.index({ region: 1, fuelType: 1, updatedAt: -1 });
exports.FuelPricePH = (0, mongoose_1.model)("FuelPricePH", FuelPricePHSchema);
