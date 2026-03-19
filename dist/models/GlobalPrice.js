"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalPrice = void 0;
const mongoose_1 = require("mongoose");
const enums_1 = require("./enums");
const GlobalPriceSchema = new mongoose_1.Schema({
    type: { type: String, enum: enums_1.GlobalPriceTypeValues, required: true, index: true },
    value: { type: Number, required: true },
    changePercent: { type: Number, required: true },
    timestamp: { type: Date, required: true, index: true },
}, { timestamps: true });
GlobalPriceSchema.index({ type: 1, timestamp: -1 });
exports.GlobalPrice = (0, mongoose_1.model)("GlobalPrice", GlobalPriceSchema);
