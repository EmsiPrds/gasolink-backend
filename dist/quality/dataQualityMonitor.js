"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDataQualityMonitor = runDataQualityMonitor;
const Alert_1 = require("../models/Alert");
const NormalizedFuelRecord_1 = require("../models/NormalizedFuelRecord");
const RawScrapedSource_1 = require("../models/RawScrapedSource");
const UpdateLog_1 = require("../models/UpdateLog");
async function runDataQualityMonitor() {
    const now = new Date();
    const [rawFailed, normalizedCount] = await Promise.all([
        RawScrapedSource_1.RawScrapedSource.countDocuments({ processingStatus: "failed" }),
        NormalizedFuelRecord_1.NormalizedFuelRecord.countDocuments({}),
    ]);
    if (rawFailed > 0) {
        await Alert_1.Alert.create({
            title: "Scraping failures detected",
            message: `There are ${rawFailed} raw snapshots marked failed. Review parser/source issues.`,
            level: "warning",
            active: true,
            createdAt: now,
        });
    }
    // Basic sanity: negative prices should never exist in normalized records.
    const negativePrices = await NormalizedFuelRecord_1.NormalizedFuelRecord.countDocuments({
        pricePerLiter: { $lt: 0 },
    });
    if (negativePrices > 0) {
        await Alert_1.Alert.create({
            title: "Invalid negative prices detected",
            message: `Found ${negativePrices} records with negative prices. These should be rejected upstream.`,
            level: "critical",
            active: true,
            createdAt: now,
        });
    }
    await UpdateLog_1.UpdateLog.create({
        module: "data_quality",
        status: "success",
        message: `Quality monitor ran. normalizedCount=${normalizedCount} rawFailed=${rawFailed}`,
        timestamp: now,
    });
}
