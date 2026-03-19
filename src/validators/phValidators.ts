import { z } from "zod";
import { FuelTypeValues, RegionValues } from "../models/enums";
import { PeriodSchema } from "../utils/period";

export const PhLatestQuerySchema = z.object({
  region: z.enum(RegionValues).optional().default("NCR"),
});

export const PhHistoryQuerySchema = z.object({
  fuelType: z.enum(FuelTypeValues),
  region: z.enum(RegionValues).optional().default("NCR"),
  period: PeriodSchema,
});

