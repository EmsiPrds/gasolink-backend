import { z } from "zod";
import { FuelTypeValues, RegionValues, SourceTypeValues, StatusLabelValues } from "../models/enums";

export const NormalizedCandidateSchema = z.object({
  sourceType: z.enum(SourceTypeValues),
  statusLabel: z.enum(StatusLabelValues),
  confidenceScore: z.number().min(0).max(1),

  companyName: z.string().min(1).optional(),
  stationName: z.string().min(1).optional(),
  fuelType: z.enum(FuelTypeValues),
  productName: z.string().min(1).optional(),

  region: z.enum(RegionValues),
  city: z.string().min(1).optional(),

  pricePerLiter: z.number().min(0).optional(),
  priceChange: z.number().optional(),
  currency: z.literal("PHP"),

  sourceName: z.string().min(1),
  sourceUrl: z.string().url(),
  sourcePublishedAt: z.coerce.date().optional(),
  scrapedAt: z.coerce.date(),
  effectiveAt: z.coerce.date().optional(),
});

export type NormalizedCandidateInput = z.infer<typeof NormalizedCandidateSchema>;

export function validateCandidate(candidate: unknown): NormalizedCandidateInput {
  return NormalizedCandidateSchema.parse(candidate);
}

