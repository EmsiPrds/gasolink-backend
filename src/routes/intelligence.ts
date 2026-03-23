import { Router } from "express";
import { getAtimonanIntelligence, handleAtimonanChat } from "../controllers/intelligenceController";

export const intelligenceRouter = Router();

/**
 * @route GET /api/intelligence/atimonan
 * @desc Get comprehensive fuel price intelligence for Atimonan
 */
intelligenceRouter.get("/atimonan", getAtimonanIntelligence);

/**
 * @route POST /api/intelligence/chat
 * @desc AI Chatbot query for Atimonan fuel data
 */
intelligenceRouter.post("/chat", handleAtimonanChat);
