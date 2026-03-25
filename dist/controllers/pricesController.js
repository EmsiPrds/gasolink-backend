"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportPrice = void 0;
const FuelPriceLog_1 = __importDefault(require("../models/FuelPriceLog"));
const User_1 = __importDefault(require("../models/User"));
const aiService_1 = require("../services/aiService");
const FinalPublishedFuelPrice_1 = require("../models/FinalPublishedFuelPrice");
const reportPrice = async (req, res) => {
    try {
        const { stationId, fuelType, price, userId, locationName } = req.body;
        if (!stationId || !fuelType || !price) {
            res.status(400).json({ success: false, message: "Missing required fields" });
            return;
        }
        // Context for AI validation
        const lastOfficial = await FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.findOne({
            fuelType,
            displayType: "ph_final",
            companyName: { $in: [null, ""] },
            city: { $in: [null, ""] },
            finalPrice: { $ne: null },
        }).sort({ lastVerifiedAt: -1 });
        const context = {
            regionalAverage: lastOfficial?.averagePrice ?? lastOfficial?.finalPrice ?? price,
            lastOfficialPrice: lastOfficial?.finalPrice ?? price
        };
        const aiValidation = await (0, aiService_1.validateUserReportWithAi)({ fuelType, price, location: locationName || "Unknown" }, context);
        let confidenceScore = Math.round(aiValidation.confidence * 100);
        let isOutlier = !aiValidation.isValid;
        if (userId) {
            const user = await User_1.default.findById(userId);
            if (user) {
                // User's trust score adds to the AI confidence
                confidenceScore = Math.min(100, confidenceScore + Math.floor(user.trustScore / 10));
            }
        }
        const newLog = await FuelPriceLog_1.default.create({
            stationId,
            fuelType,
            price,
            source: "USER",
            reportedBy: userId || null,
            aiConfidenceScore: confidenceScore,
            isOutlier,
            aiReasoning: aiValidation.reasoning,
            locationName: locationName || "Unknown"
        });
        res.status(201).json({
            success: true,
            data: newLog,
            message: aiValidation.isValid ? "Price reported successfully" : "Price reported, but flagged for review."
        });
    }
    catch (error) {
        console.error("Error reporting price:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
exports.reportPrice = reportPrice;
