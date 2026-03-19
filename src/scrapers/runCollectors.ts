import { sources } from "../sources/sources.config";
import type { CollectorRunResult } from "./collectorTypes";
import { staticHtmlCollector } from "./collectors/staticHtmlCollector";
import { dynamicBrowserCollector } from "./collectors/dynamicBrowserCollector";
import { UpdateLog } from "../models/UpdateLog";

const collectors = [staticHtmlCollector, dynamicBrowserCollector];

export async function runAllCollectors(): Promise<CollectorRunResult[]> {
  if (sources.length === 0) {
    await UpdateLog.create({
      module: "collectors",
      status: "success",
      message: "No sources configured; collectors skipped.",
      timestamp: new Date(),
    });
    return [];
  }

  const results: CollectorRunResult[] = [];
  for (const src of sources) {
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

