import { z } from "zod";
import { GlobalPriceTypeValues } from "../models/enums";
import { PeriodSchema } from "../utils/period";

export const GlobalHistoryQuerySchema = z.object({
  type: z.enum(GlobalPriceTypeValues),
  period: PeriodSchema,
});

