import { Router } from "express";
import { getPhHistory, getPhLatest, getPhObserved, getPhSourceDetails, reportPublicPrice } from "../controllers/phControllerV2";

export const phRouter = Router();

phRouter.get("/latest", getPhLatest);
phRouter.get("/history", getPhHistory);
phRouter.get("/observed", getPhObserved);
phRouter.get("/sources/:id", getPhSourceDetails);

// Accuracy-first pipeline: public user price reporting (Observed)
phRouter.post("/report", reportPublicPrice);

