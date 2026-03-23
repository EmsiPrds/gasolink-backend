import { Router } from "express";
import { reportPrice } from "../controllers/pricesController";

export const pricesRouter = Router();

pricesRouter.post("/report", reportPrice);
