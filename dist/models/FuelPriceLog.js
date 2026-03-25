"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const enums_1 = require("./enums");
const FuelPriceLogSchema = new mongoose_1.Schema({
    stationId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Station", required: true },
    fuelType: { type: String, enum: enums_1.FuelTypeValues, required: true },
    price: { type: Number, required: true },
    source: { type: String, enum: ["SCRAPER", "USER"], required: true },
    reportedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    aiConfidenceScore: { type: Number, default: 0 }, // 0 to 100
    isOutlier: { type: Boolean, default: false },
    aiReasoning: { type: String },
    locationName: { type: String },
    reportedAt: { type: Date, default: Date.now },
}, { timestamps: true });
FuelPriceLogSchema.index({ stationId: 1, fuelType: 1, reportedAt: -1 });
exports.default = mongoose_1.default.models.FuelPriceLog || mongoose_1.default.model("FuelPriceLog", FuelPriceLogSchema);
