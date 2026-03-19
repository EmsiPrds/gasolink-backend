import { Router } from "express";
import { getForecast } from "../controllers/forecastController";

export const forecastRouter = Router();

forecastRouter.get("/", getForecast);

