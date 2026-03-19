import type { SourceParser } from "../parserTypes";
import { doeListingParser } from "./doeListingParser";

/**
 * Backward-compatible aliases.
 *
 * Older raw snapshots may have these parserId values. Treat them as listing pages
 * so they can discover DOE articles/PDFs and proceed through the pipeline.
 */
export const doeNoticesAliasParser: SourceParser = {
  id: "doe_notices_alias_v1",
  canHandle: (raw) => raw.parserId === "doe_notices_v1",
  parse: async (raw) => doeListingParser.parse(raw),
};

export const doeServicesAliasParser: SourceParser = {
  id: "doe_services_alias_v1",
  canHandle: (raw) => raw.parserId === "doe_services_v1",
  parse: async (raw) => doeListingParser.parse(raw),
};

