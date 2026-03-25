import { RawScrapedSource } from "../models/RawScrapedSource";
import type { SourceType } from "../models/enums";
import { sha256Hex } from "../normalization/fingerprint";
import { sources } from "../sources/sources.config";
import type { SourceDefinition } from "../sources/types";
import { env } from "../config/env";
import { fetchDynamic, fetchStatic, type FetchResult } from "../utils/http";

type CollectionScope = "official" | "all";

export type SourceCollectionResult = {
  attempted: number;
  created: number;
  skippedUnchanged: number;
  failed: number;
  scope: CollectionScope;
};

function normalizeSnapshotText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function buildContentHash(source: SourceDefinition, html: string, text: string): string {
  const normalized = normalizeSnapshotText(text || html);
  return sha256Hex(`${source.url}\n${normalized}`);
}

function selectSources(scope: CollectionScope): SourceDefinition[] {
  const base = env.SOURCES_MODE === "doe_only" ? sources.filter((source) => source.sourceType === "official_local") : sources;
  if (scope === "official") {
    const excludedPrimaryIds = new Set(["doe_fb", "doe_oil_monitor_listing", "doe_price_adjustments_listing"]);
    return base.filter(
      (source) =>
        source.sourceType === "official_local" &&
        !excludedPrimaryIds.has(source.id) &&
        source.parserId !== "ai_groq_v1" &&
        !source.url.includes("facebook.com"),
    );
  }
  return base;
}

function shouldCreateFailureSnapshot(
  latest:
    | {
        processingStatus?: string;
        scrapedAt?: Date;
      }
    | null,
  now: Date,
): boolean {
  if (!latest || latest.processingStatus !== "failed" || !latest.scrapedAt) return true;
  return now.getTime() - latest.scrapedAt.getTime() > 2 * 60 * 60 * 1000;
}

function shouldCreateSuccessSnapshot(
  latest:
    | {
        processingStatus?: string;
        contentHash?: string | null;
      }
    | null,
  contentHash: string,
): boolean {
  if (!latest || latest.processingStatus === "failed") return true;
  return latest.contentHash !== contentHash;
}

async function fetchSourceSnapshot(source: SourceDefinition): Promise<FetchResult> {
  if (source.scrapeMode === "dynamic_browser") {
    const dynamic = await fetchDynamic(source.url);
    if (dynamic.status >= 200 && dynamic.status < 300 && (dynamic.html || dynamic.text)) {
      return dynamic;
    }
  }

  return fetchStatic(source.url);
}

export async function runConfiguredSourceCollection(params?: { scope?: CollectionScope }): Promise<SourceCollectionResult> {
  const scope = params?.scope ?? "official";
  const selectedSources = selectSources(scope);

  let attempted = 0;
  let created = 0;
  let skippedUnchanged = 0;
  let failed = 0;

  for (const source of selectedSources) {
    attempted += 1;
    const now = new Date();

    const latest = await RawScrapedSource.findOne({
      sourceUrl: source.url,
      parserId: source.parserId,
    })
      .sort({ scrapedAt: -1 })
      .select({ processingStatus: 1, scrapedAt: 1, contentHash: 1 })
      .lean();

    try {
      const fetched = await fetchSourceSnapshot(source);
      if (fetched.status < 200 || fetched.status >= 300) {
        failed += 1;
        if (shouldCreateFailureSnapshot(latest, now)) {
          await RawScrapedSource.create({
            sourceType: source.sourceType,
            sourceName: source.sourceName,
            sourceUrl: source.url,
            parserId: source.parserId,
            scrapedAt: now,
            parserVersion: "v1",
            processingStatus: "failed",
            errorMessage: `HTTP ${fetched.status}`,
          });
        }
        continue;
      }

      const contentHash = buildContentHash(source, fetched.html, fetched.text);
      if (!shouldCreateSuccessSnapshot(latest, contentHash)) {
        skippedUnchanged += 1;
        continue;
      }

      await RawScrapedSource.create({
        sourceType: source.sourceType as Exclude<SourceType, "global_api" | "estimate">,
        sourceName: source.sourceName,
        sourceUrl: source.url,
        parserId: source.parserId,
        rawHtml: fetched.html,
        rawText: fetched.text,
        contentHash,
        scrapedAt: now,
        parserVersion: "v1",
        processingStatus: "raw",
      });
      created += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      if (shouldCreateFailureSnapshot(latest, now)) {
        await RawScrapedSource.create({
          sourceType: source.sourceType,
          sourceName: source.sourceName,
          sourceUrl: source.url,
          parserId: source.parserId,
          scrapedAt: now,
          parserVersion: "v1",
          processingStatus: "failed",
          errorMessage: message,
        });
      }
    }
  }

  return {
    attempted,
    created,
    skippedUnchanged,
    failed,
    scope,
  };
}
