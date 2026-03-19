import { RawScrapedSource } from "../../models/RawScrapedSource";
import type { SourceDefinition } from "../../sources/types";
import { fetchStatic } from "../httpFetch";
import type { Collector } from "../collectorTypes";

export const staticHtmlCollector: Collector = {
  name: "StaticHtmlCollector",
  canHandle: (src: SourceDefinition) => src.scrapeMode === "static_html",
  runOne: async (src: SourceDefinition) => {
    try {
      const fetched = await fetchStatic(src.url);
      if (fetched.status < 200 || fetched.status >= 300) {
        const raw = await RawScrapedSource.create({
          sourceType: src.sourceType,
          sourceName: src.sourceName,
          sourceUrl: src.url,
          parserId: src.parserId,
          rawText: fetched.text ?? fetched.html ?? "",
          scrapedAt: new Date(),
          parserVersion: "v1",
          processingStatus: "failed",
          errorMessage: `HTTP ${fetched.status}`,
        });
        return { sourceId: src.id, ok: false, raw, error: `HTTP ${fetched.status}` };
      }

      const raw = await RawScrapedSource.create({
        sourceType: src.sourceType,
        sourceName: src.sourceName,
        sourceUrl: src.url,
        parserId: src.parserId,
        rawHtml: fetched.html,
        rawText: fetched.text,
        scrapedAt: new Date(),
        parserVersion: "v1",
        processingStatus: "raw",
      });

      return { sourceId: src.id, ok: true, raw };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const raw = await RawScrapedSource.create({
        sourceType: src.sourceType,
        sourceName: src.sourceName,
        sourceUrl: src.url,
        parserId: src.parserId,
        rawText: msg,
        scrapedAt: new Date(),
        parserVersion: "v1",
        processingStatus: "failed",
        errorMessage: msg,
      });
      return { sourceId: src.id, ok: false, raw, error: msg };
    }
  },
};

