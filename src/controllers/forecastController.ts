import type { Request, Response } from "express";
import { ok } from "../utils/apiResponse";
import { z } from "zod";
import { RegionValues } from "../models/enums";
import { buildForecast } from "../services/forecastService";

const ForecastQuerySchema = z.object({
  region: z.enum(RegionValues).optional().default("NCR"),
});

export async function getForecast(req: Request, res: Response) {
  const { region } = ForecastQuerySchema.parse(req.query);
  const data = await buildForecast(region);
  return res.json(ok(data));
}

