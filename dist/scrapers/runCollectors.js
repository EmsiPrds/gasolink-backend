"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAllCollectors = runAllCollectors;
const sources_config_1 = require("../sources/sources.config");
const staticHtmlCollector_1 = require("./collectors/staticHtmlCollector");
const dynamicBrowserCollector_1 = require("./collectors/dynamicBrowserCollector");
const UpdateLog_1 = require("../models/UpdateLog");
const env_1 = require("../config/env");
const collectors = [staticHtmlCollector_1.staticHtmlCollector, dynamicBrowserCollector_1.dynamicBrowserCollector];
async function runAllCollectors() {
    const mode = env_1.env.SOURCES_MODE ?? "all";
    const selected = mode === "doe_only" ? sources_config_1.sources.filter((s) => s.sourceType === "official_local") : sources_config_1.sources;
    if (selected.length === 0) {
        await UpdateLog_1.UpdateLog.create({
            module: "collectors",
            status: "success",
            message: mode === "doe_only" ? "No DOE sources configured; collectors skipped." : "No sources configured; collectors skipped.",
            timestamp: new Date(),
        });
        return [];
    }
    if (mode !== "all") {
        await UpdateLog_1.UpdateLog.create({
            module: "collectors",
            status: "success",
            message: `Collectors source filter enabled. mode=${mode} allowed=${selected.length} blocked=${Math.max(0, sources_config_1.sources.length - selected.length)}`,
            timestamp: new Date(),
        });
    }
    const results = [];
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
    await UpdateLog_1.UpdateLog.create({
        module: "collectors",
        status: failCount > 0 ? "failure" : "success",
        message: `Collectors finished. ok=${okCount} fail=${failCount}`,
        timestamp: new Date(),
    });
    return results;
}
