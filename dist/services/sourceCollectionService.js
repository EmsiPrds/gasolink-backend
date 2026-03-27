"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runConfiguredSourceCollection = runConfiguredSourceCollection;
const node_crypto_1 = __importDefault(require("node:crypto"));
const RawScrapedSource_1 = require("../models/RawScrapedSource");
const sources_config_1 = require("../sources/sources.config");
const http_1 = require("../utils/http");
async function runConfiguredSourceCollection(params) {
    const scope = params?.scope ?? "official";
    const selectedSources = sources_config_1.sources.filter((source) => (scope === "official" ? source.sourceType === "official_local" : true));
    let attempted = 0;
    let created = 0;
    let skippedUnchanged = 0;
    let failed = 0;
    for (const source of selectedSources) {
        attempted += 1;
        const fetched = source.scrapeMode === "dynamic_browser" ? await (0, http_1.fetchDynamic)(source.url) : await (0, http_1.fetchStatic)(source.url);
        const rawHtml = fetched.html || "";
        const rawText = fetched.text || "";
        const contentHash = rawHtml
            ? node_crypto_1.default.createHash("sha256").update(rawHtml).digest("hex")
            : node_crypto_1.default.createHash("sha256").update(`${source.url}:${Date.now()}`).digest("hex");
        const latest = await RawScrapedSource_1.RawScrapedSource.findOne({ sourceUrl: source.url }).sort({ scrapedAt: -1 }).select({ contentHash: 1 }).lean();
        if (latest?.contentHash && latest.contentHash === contentHash) {
            skippedUnchanged += 1;
            continue;
        }
        if (fetched.status < 200 || fetched.status >= 300) {
            failed += 1;
            await RawScrapedSource_1.RawScrapedSource.create({
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
        await RawScrapedSource_1.RawScrapedSource.create({
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
