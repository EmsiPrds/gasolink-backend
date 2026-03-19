import type { SourceType } from "../models/enums";

export function maxAgeMsForSourceType(sourceType: SourceType): number {
  switch (sourceType) {
    case "global_api":
      return 10 * 60 * 1000; // 10 minutes
    case "official_local":
      return 7 * 24 * 60 * 60 * 1000; // 7 days (weekly cycle)
    case "company_advisory":
      return 7 * 24 * 60 * 60 * 1000;
    case "observed_station":
      return 48 * 60 * 60 * 1000; // 48 hours
    case "estimate":
      return 24 * 60 * 60 * 1000; // 24 hours
    default: {
      const _exhaustive: never = sourceType;
      return _exhaustive;
    }
  }
}

export function isStale(sourceType: SourceType, lastVerifiedAt: Date, now = new Date()): boolean {
  return now.getTime() - lastVerifiedAt.getTime() > maxAgeMsForSourceType(sourceType);
}

