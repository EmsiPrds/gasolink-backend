export const PriceStatusValues = ["Verified", "Advisory", "Estimate"] as const;
export type PriceStatus = (typeof PriceStatusValues)[number];

export const RegionValues = ["NCR", "Luzon", "Visayas", "Mindanao"] as const;
export type Region = (typeof RegionValues)[number];

export const FuelTypeValues = ["Gasoline", "Diesel", "Kerosene"] as const;
export type FuelType = (typeof FuelTypeValues)[number];

export const GlobalPriceTypeValues = ["Brent", "WTI", "USDPHP"] as const;
export type GlobalPriceType = (typeof GlobalPriceTypeValues)[number];

export const AlertLevelValues = ["info", "warning", "critical"] as const;
export type AlertLevel = (typeof AlertLevelValues)[number];

export const InsightStatusValues = ["active", "inactive"] as const;
export type InsightStatus = (typeof InsightStatusValues)[number];

export const UpdateLogStatusValues = ["success", "failure"] as const;
export type UpdateLogStatus = (typeof UpdateLogStatusValues)[number];

// Accuracy-first pipeline (source-aware data classification)
export const SourceTypeValues = [
  "global_api",
  "official_local",
  "company_advisory",
  "observed_station",
  "estimate",
] as const;
export type SourceType = (typeof SourceTypeValues)[number];

export const StatusLabelValues = ["Verified", "Official", "Advisory", "Observed", "Estimate"] as const;
export type StatusLabel = (typeof StatusLabelValues)[number];

export const ProcessingStatusValues = ["raw", "normalized", "failed"] as const;
export type ProcessingStatus = (typeof ProcessingStatusValues)[number];


