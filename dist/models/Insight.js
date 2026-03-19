"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Insight = void 0;
const mongoose_1 = require("mongoose");
const enums_1 = require("./enums");
const InsightSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    category: { type: String, required: true, trim: true, index: true },
    status: { type: String, enum: enums_1.InsightStatusValues, required: true, default: "active", index: true },
    createdAt: { type: Date, required: true, default: () => new Date(), index: true },
}, { timestamps: true });
InsightSchema.index({ status: 1, createdAt: -1 });
exports.Insight = (0, mongoose_1.model)("Insight", InsightSchema);
