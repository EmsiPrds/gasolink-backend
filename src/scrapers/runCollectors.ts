import { sources } from "../sources/sources.config";
import type { CollectorRunResult } from "./collectorTypes";
import { staticHtmlCollector } from "./collectors/staticHtmlCollector";
import { dynamicBrowserCollector } from "./collectors/dynamicBrowserCollector";
import { UpdateLog } from "../models/UpdateLog";
import { env } from "../config/env";

const collectors = [staticHtmlCollector, dynamicBrowserCollector];

export async function runAllCollectors(): Promise<CollectorRunResult[]> {
  const mode = env.SOURCES_MODE ?? "all";
  const selected =
    mode === "doe_only" ? sources.filter((s) => s.sourceType === "official_local") : sources;

  if (selected.length === 0) {
    await UpdateLog.create({
      module: "collectors",
      status: "success",
      message: mode === "doe_only" ? "No DOE sources configured; collectors skipped." : "No sources configured; collectors skipped.",
      timestamp: new Date(),
    });
    return [];
  }

  if (mode !== "all") {
    await UpdateLog.create({
      module: "collectors",
      status: "success",
      message: `Collectors source filter enabled. mode=${mode} allowed=${selected.length} blocked=${Math.max(
        0,
        sources.length - selected.length,
      )}`,
      timestamp: new Date(),
    });
  }

  const results: CollectorRunResult[] = [];
  for (const src of selected) {
    const collector = collectors.find((c) => c.canHandle(src));
    if (!collector) {
      results.push({ sourceId: src.id, ok: false, error: "No collector for scrapeMode" });
      continue;
    }
    const r = await collector.runOne(src);
    results.push(r);
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  await UpdateLog.create({
    module: "collectors",
    status: failCount > 0 ? "failure" : "success",
    message: `Collectors finished. ok=${okCount} fail=${failCount}`,
    timestamp: new Date(),
  });

  return results;
}

