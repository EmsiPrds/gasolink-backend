import { Router } from "express";
import { getInsights } from "../controllers/insightsController";

export const insightsRouter = Router();

insightsRouter.get("/", getInsights);

