import { Request, Response } from "express";
import { IntelligenceService } from "../services/intelligenceService";
import type { FuelType } from "../models/enums";

/**
 * Endpoint for getting Atimonan-specific fuel intelligence.
 */
export const getAtimonanIntelligence = async (req: Request, res: Response) => {
  try {
    const fuelType = (req.query.fuelType as FuelType) || "Gasoline";
    const intel = await IntelligenceService.getFuelIntelligence(fuelType);
    res.json({ success: true, data: intel });
  } catch (error) {
    console.error("Error fetching Atimonan intelligence:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Chatbot endpoint for querying Atimonan fuel data.
 */
export const handleAtimonanChat = async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) {
      res.status(400).json({ success: false, message: "Query is required." });
      return;
    }
    const response = await IntelligenceService.handleChatQuery(query);
    res.json({ success: true, message: response });
  } catch (error) {
    console.error("Error handling Atimonan chat:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
