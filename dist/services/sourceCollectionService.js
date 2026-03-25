"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runConfiguredSourceCollection = runConfiguredSourceCollection;
const RawScrapedSource_1 = require("../models/RawScrapedSource");
const fingerprint_1 = require("../normalization/fingerprint");
const sources_config_1 = require("../sources/sources.config");
const env_1 = require("../config/env");
const http_1 = require("../utils/http");
function normalizeSnapshotText(text) {
    return text.replace(/\s+/g, " ").trim();
}
function buildContentHash(source, html, text) {
    const normalized = normalizeSnapshotText(text || html);
    return (0, fingerprint_1.sha256Hex)(`${source.url}\n${normalized}`);
}
function selectSources(scope) {
    const base = env_1.env.SOURCES_MODE === "doe_only" ? sources_config_1.sources.filter((source) => source.sourceType === "official_local") : sources_config_1.sources;
    if (scope === "official") {
        const excludedPrimaryIds = new Set(["doe_fb", "doe_oil_monitor_listing", "doe_price_adjustments_listing"]);
        return base.filter((source) => source.sourceType === "official_local" &&
            !excludedPrimaryIds.has(source.id) &&
            source.parserId !== "ai_groq_v1" &&
            !source.url.includes("facebook.com"));
    }
    return base;
}
function shouldCreateFailureSnapshot(latest, now) {
    if (!latest || latest.processingStatus !== "failed" || !latest.scrapedAt)
        return true;
    return now.getTime() - latest.scrapedAt.getTime() > 2 * 60 * 60 * 1000;
}
function shouldCreateSuccessSnapshot(latest, contentHash) {
    if (!latest || latest.processingStatus === "failed")
        return true;
    return latest.contentHash !== contentHash;
}
async function fetchSourceSnapshot(source) {
    if (source.scrapeMode === "dynamic_browser") {
        const dynamic = await (0, http_1.fetchDynamic)(source.url);
        if (dynamic.status >= 200 && dynamic.status < 300 && (dynamic.html || dynamic.text)) {
            return dynamic;
        }
    }
    return (0, http_1.fetchStatic)(source.url);
}
async function runConfiguredSourceCollection(params) {
    const scope = params?.scope ?? "official";
    const selectedSources = selectSources(scope);
    let attempted = 0;
    let created = 0;
    let skippedUnchanged = 0;
    let failed = 0;
    for (const source of selectedSources) {
        attempted += 1;
        const now = new Date();
        const latest = await RawScrapedSource_1.RawScrapedSource.findOne({
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
                    await RawScrapedSource_1.RawScrapedSource.create({
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
            await RawScrapedSource_1.RawScrapedSource.create({
                sourceType: source.sourceType,
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
        }
        catch (error) {
            failed += 1;
            const message = error instanceof Error ? error.message : String(error);
            if (shouldCreateFailureSnapshot(latest, now)) {
                await RawScrapedSource_1.RawScrapedSource.create({
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
