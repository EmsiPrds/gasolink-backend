"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateLog = void 0;
const mongoose_1 = require("mongoose");
const enums_1 = require("./enums");
const UpdateLogSchema = new mongoose_1.Schema({
    module: { type: String, required: true, trim: true, index: true },
    status: { type: String, enum: enums_1.UpdateLogStatusValues, required: true, index: true },
    message: { type: String, required: true },
    timestamp: { type: Date, required: true, default: () => new Date(), index: true },
}, { timestamps: true });
UpdateLogSchema.index({ module: 1, timestamp: -1 });
exports.UpdateLog = (0, mongoose_1.model)("UpdateLog", UpdateLogSchema);
