type CollectionScope = "official" | "all";
import crypto from "node:crypto";
import { RawScrapedSource } from "../models/RawScrapedSource";
import { sources } from "../sources/sources.config";
import { fetchDynamic, fetchStatic } from "../utils/http";

export type SourceCollectionResult = {
  attempted: number;
  created: number;
  skippedUnchanged: number;
  failed: number;
  scope: CollectionScope;
};

export async function runConfiguredSourceCollection(params?: { scope?: CollectionScope }): Promise<SourceCollectionResult> {
  const scope = params?.scope ?? "official";
  const selectedSources = sources.filter((source) => (scope === "official" ? source.sourceType === "official_local" : true));

  let attempted = 0;
  let created = 0;
  let skippedUnchanged = 0;
  let failed = 0;

  for (const source of selectedSources) {
    attempted += 1;
    const fetched = source.scrapeMode === "dynamic_browser" ? await fetchDynamic(source.url) : await fetchStatic(source.url);
    const rawHtml = fetched.html || "";
    const rawText = fetched.text || "";
    const contentHash = rawHtml
      ? crypto.createHash("sha256").update(rawHtml).digest("hex")
      : crypto.createHash("sha256").update(`${source.url}:${Date.now()}`).digest("hex");

    const latest = await RawScrapedSource.findOne({ sourceUrl: source.url }).sort({ scrapedAt: -1 }).select({ contentHash: 1 }).lean();
    if (latest?.contentHash && latest.contentHash === contentHash) {
      skippedUnchanged += 1;
      continue;
    }

    if (fetched.status < 200 || fetched.status >= 300) {
      failed += 1;
      await RawScrapedSource.create({
        sourceType: source.sourceType,
        sourceName: source.sourceName,
        sourceUrl: source.url,
        parserId: source.parserId,
        rawHtml,
        rawText,
        contentHash,
        processingStatus: "failed",
        errorMessage: `HTTP ${fetched.status}`,
        parserVersion: "v1",
      });
      continue;
    }

    await RawScrapedSource.create({
      sourceType: source.sourceType,
      sourceName: source.sourceName,
      sourceUrl: source.url,
      parserId: source.parserId,
      rawHtml,
      rawText,
      contentHash,
      processingStatus: "raw",
      parserVersion: "v1",
    });
    created += 1;
  }

  return { attempted, created, skippedUnchanged, failed, scope };
}
