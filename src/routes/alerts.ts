import { Router } from "express";
import { getAlerts } from "../controllers/alertsController";

export const alertsRouter = Router();

alertsRouter.get("/", getAlerts);

