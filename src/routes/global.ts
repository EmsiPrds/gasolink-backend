import { Router } from "express";
import { getGlobalHistory, getGlobalLatest } from "../controllers/globalController";

export const globalRouter = Router();

globalRouter.get("/latest", getGlobalLatest);
globalRouter.get("/history", getGlobalHistory);

