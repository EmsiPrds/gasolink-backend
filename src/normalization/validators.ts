import { z } from "zod";
import { FuelTypeValues, RegionValues, SourceTypeValues, StatusLabelValues } from "../models/enums";

export const NormalizedCandidateSchema = z.object({
  sourceType: z.enum(SourceTypeValues),
  statusLabel: z.enum(StatusLabelValues),
  confidenceScore: z.number().min(0).max(1),

  companyName: z.string().min(1).nullish(),
  stationName: z.string().min(1).nullish(),
  fuelType: z.enum(FuelTypeValues),
  productName: z.string().min(1).nullish(),

  region: z.enum(RegionValues),
  city: z.string().min(1).nullish(),

  pricePerLiter: z.number().min(0).nullish(),
  priceChange: z.number().nullish(),
  currency: z.literal("PHP"),

  sourceName: z.string().min(1),
  sourceUrl: z.string().url(),
  sourcePublishedAt: z.coerce.date().nullish(),
  scrapedAt: z.coerce.date(),
  effectiveAt: z.coerce.date().nullish(),
});

export type NormalizedCandidateInput = z.infer<typeof NormalizedCandidateSchema>;

export function validateCandidate(candidate: unknown): NormalizedCandidateInput {
  return NormalizedCandidateSchema.parse(candidate);
}

