"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.staticHtmlCollector = void 0;
const RawScrapedSource_1 = require("../../models/RawScrapedSource");
const httpFetch_1 = require("../httpFetch");
exports.staticHtmlCollector = {
    name: "StaticHtmlCollector",
    canHandle: (src) => src.scrapeMode === "static_html",
    runOne: async (src) => {
        try {
            const fetched = await (0, httpFetch_1.fetchStatic)(src.url);
            if (fetched.status < 200 || fetched.status >= 300) {
                const raw = await RawScrapedSource_1.RawScrapedSource.create({
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
            const raw = await RawScrapedSource_1.RawScrapedSource.create({
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
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const raw = await RawScrapedSource_1.RawScrapedSource.create({
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
