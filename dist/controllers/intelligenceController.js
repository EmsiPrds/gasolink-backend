"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAtimonanChat = exports.getAtimonanIntelligence = void 0;
const intelligenceService_1 = require("../services/intelligenceService");
/**
 * Endpoint for getting Atimonan-specific fuel intelligence.
 */
const getAtimonanIntelligence = async (req, res) => {
    try {
        const fuelType = req.query.fuelType || "Gasoline";
        const intel = await intelligenceService_1.IntelligenceService.getFuelIntelligence(fuelType);
        res.json({ success: true, data: intel });
    }
    catch (error) {
        console.error("Error fetching Atimonan intelligence:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
exports.getAtimonanIntelligence = getAtimonanIntelligence;
/**
 * Chatbot endpoint for querying Atimonan fuel data.
 */
const handleAtimonanChat = async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            res.status(400).json({ success: false, message: "Query is required." });
            return;
        }
        const response = await intelligenceService_1.IntelligenceService.handleChatQuery(query);
        res.json({ success: true, message: response });
    }
    catch (error) {
        console.error("Error handling Atimonan chat:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
exports.handleAtimonanChat = handleAtimonanChat;
