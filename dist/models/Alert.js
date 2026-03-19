"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Alert = void 0;
const mongoose_1 = require("mongoose");
const enums_1 = require("./enums");
const AlertSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    level: { type: String, enum: enums_1.AlertLevelValues, required: true, default: "info", index: true },
    active: { type: Boolean, required: true, default: true, index: true },
    createdAt: { type: Date, required: true, default: () => new Date(), index: true },
}, { timestamps: true });
AlertSchema.index({ active: 1, createdAt: -1 });
exports.Alert = (0, mongoose_1.model)("Alert", AlertSchema);
