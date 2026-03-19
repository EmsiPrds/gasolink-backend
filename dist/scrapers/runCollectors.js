"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAllCollectors = runAllCollectors;
const sources_config_1 = require("../sources/sources.config");
const staticHtmlCollector_1 = require("./collectors/staticHtmlCollector");
const dynamicBrowserCollector_1 = require("./collectors/dynamicBrowserCollector");
const UpdateLog_1 = require("../models/UpdateLog");
const collectors = [staticHtmlCollector_1.staticHtmlCollector, dynamicBrowserCollector_1.dynamicBrowserCollector];
async function runAllCollectors() {
    if (sources_config_1.sources.length === 0) {
        await UpdateLog_1.UpdateLog.create({
            module: "collectors",
            status: "success",
            message: "No sources configured; collectors skipped.",
            timestamp: new Date(),
        });
        return [];
    }
    const results = [];
    for (const src of sources_config_1.sources) {
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
    await UpdateLog_1.UpdateLog.create({
        module: "collectors",
        status: failCount > 0 ? "failure" : "success",
        message: `Collectors finished. ok=${okCount} fail=${failCount}`,
        timestamp: new Date(),
    });
    return results;
}
