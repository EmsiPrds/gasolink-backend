import type { Collector } from "../collectorTypes";
import type { SourceDefinition } from "../../sources/types";
import { RawScrapedSource } from "../../models/RawScrapedSource";
import { chromium } from "playwright";

/**
 * Dynamic collector scaffold.
 *
 * No-login, best-effort collection intended for public pages (e.g., Facebook).
 * Accuracy rule: if we can't reliably extract, we store raw + mark failed; we never publish blindly.
 */
export const dynamicBrowserCollector: Collector = {
  name: "DynamicBrowserCollector",
  canHandle: (src: SourceDefinition) => src.scrapeMode === "dynamic_browser",
  runOne: async (src: SourceDefinition) => {
    try {
      // Force using the installed Chromium executable. On some Windows installs,
      // Playwright may look for chromium_headless_shell which may not be present.
      const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
      const page = await browser.newPage({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
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

      const raw = await RawScrapedSource.create({
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

