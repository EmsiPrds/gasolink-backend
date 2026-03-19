"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamicBrowserCollector = void 0;
const RawScrapedSource_1 = require("../../models/RawScrapedSource");
/**
 * Dynamic collector scaffold.
 *
 * No-login, best-effort collection intended for public pages (e.g., Facebook).
 * Accuracy rule: if we can't reliably extract, we store raw + mark failed; we never publish blindly.
 */
exports.dynamicBrowserCollector = {
    name: "DynamicBrowserCollector",
    canHandle: (src) => src.scrapeMode === "dynamic_browser",
    runOne: async (src) => {
        try {
            // Ensure Playwright uses a stable, project-local browsers path.
            // When running under certain IDE sandboxes, the default cache path can change,
            // which makes Playwright look for a non-existent executable.
            // Force override (Cursor may set this to a sandbox cache path).
            process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
            // Import after setting env var so Playwright resolves the correct browsers path.
            const { chromium } = await Promise.resolve().then(() => __importStar(require("playwright")));
            const browser = await chromium.launch({ headless: true });
            const page = await browser.newPage({
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
            });
            page.setDefaultTimeout(30_000);
            await page.goto(src.url, { waitUntil: "domcontentloaded" });
            await page.waitForTimeout(2_000);
            // Best-effort scroll to load a bit more content
            for (let i = 0; i < 3; i++) {
                await page.mouse.wheel(0, 1200);
                await page.waitForTimeout(1_000);
            }
            const html = await page.content();
            await browser.close();
            const raw = await RawScrapedSource_1.RawScrapedSource.create({
                sourceType: src.sourceType,
                sourceName: src.sourceName,
                sourceUrl: src.url,
                parserId: src.parserId,
                rawHtml: html,
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
