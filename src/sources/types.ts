import type { SourceType } from "../models/enums";

export type ScrapeMode = "static_html" | "dynamic_browser";

export type SourceDefinition = {
  id: string;
  sourceType: Exclude<SourceType, "global_api" | "estimate">;
  sourceName: string;
  url: string;
  scrapeMode: ScrapeMode;
  parserId: string;
};

