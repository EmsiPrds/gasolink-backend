import type { SourceType, StatusLabel } from "../models/enums";
import type { FuelType, Region } from "../models/enums";
import type { RawScrapedSourceDoc } from "../models/RawScrapedSource";

export type NormalizedCandidate = {
  sourceType: SourceType;
  statusLabel: StatusLabel;
  confidenceScore: number;

  companyName?: string;
  stationName?: string;
  fuelType: FuelType;
  productName?: string;

  region: Region;
  city?: string;

  pricePerLiter?: number;
  priceChange?: number;
  currency: "PHP";

  sourceName: string;
  sourceUrl: string;
  sourcePublishedAt?: Date;
  scrapedAt: Date;
  effectiveAt?: Date;
};

export type ParseResult = { ok: true; items: NormalizedCandidate[] } | { ok: false; error: string };

export type SourceParser = {
  id: string;
  canHandle: (raw: RawScrapedSourceDoc) => boolean;
  parse: (raw: RawScrapedSourceDoc) => Promise<ParseResult>;
};

