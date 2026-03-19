import { Router } from "express";
import { getPhHistory, getPhLatest, getPhObserved, getPhSourceDetails } from "../controllers/phControllerV2";

export const phRouter = Router();

phRouter.get("/latest", getPhLatest);
phRouter.get("/history", getPhHistory);
phRouter.get("/observed", getPhObserved);
phRouter.get("/sources/:id", getPhSourceDetails);

