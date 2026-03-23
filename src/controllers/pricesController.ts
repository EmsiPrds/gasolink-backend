import { Request, Response } from "express";
import FuelPriceLog from "../models/FuelPriceLog";
import User from "../models/User";
import { validateUserReportWithAi } from "../services/aiService";
import { FinalPublishedFuelPrice } from "../models/FinalPublishedFuelPrice";

export const reportPrice = async (req: Request, res: Response) => {
  try {
    const { stationId, fuelType, price, userId, locationName } = req.body;

    if (!stationId || !fuelType || !price) {
       res.status(400).json({ success: false, message: "Missing required fields" });
       return;
    }

    // Context for AI validation
    const lastOfficial = await FinalPublishedFuelPrice.findOne({ fuelType }).sort({ lastVerifiedAt: -1 });
    const context = {
        regionalAverage: lastOfficial?.averagePrice ?? 65.5,
        lastOfficialPrice: lastOfficial?.finalPrice ?? 65.5
    };

    const aiValidation = await validateUserReportWithAi(
        { fuelType, price, location: locationName || "Unknown" },
        context
    );

    let confidenceScore = Math.round(aiValidation.confidence * 100);
    let isOutlier = !aiValidation.isValid;

    if (userId) {
      const user = await User.findById(userId);
      if (user) {
         // User's trust score adds to the AI confidence
         confidenceScore = Math.min(100, confidenceScore + Math.floor(user.trustScore / 10));
      }
    }

    const newLog = await FuelPriceLog.create({
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
  } catch (error) {
    console.error("Error reporting price:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
