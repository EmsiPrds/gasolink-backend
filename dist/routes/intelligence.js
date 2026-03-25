"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intelligenceRouter = void 0;
const express_1 = require("express");
const intelligenceController_1 = require("../controllers/intelligenceController");
exports.intelligenceRouter = (0, express_1.Router)();
/**
 * @route GET /api/intelligence/atimonan
 * @desc Get comprehensive fuel price intelligence for Atimonan
 */
exports.intelligenceRouter.get("/atimonan", intelligenceController_1.getAtimonanIntelligence);
/**
 * @route POST /api/intelligence/chat
 * @desc AI Chatbot query for Atimonan fuel data
 */
exports.intelligenceRouter.post("/chat", intelligenceController_1.handleAtimonanChat);
