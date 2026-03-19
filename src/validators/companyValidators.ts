import { z } from "zod";
import { FuelTypeValues, RegionValues } from "../models/enums";

export const CompanyQuerySchema = z.object({
  fuelType: z.enum(FuelTypeValues).optional(),
  region: z.enum(RegionValues).optional(),
  company: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
});

