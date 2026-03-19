"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshGlobalPrices = refreshGlobalPrices;
const GlobalPrice_1 = require("../models/GlobalPrice");
const UpdateLog_1 = require("../models/UpdateLog");
function round2(n) {
    return Math.round(n * 100) / 100;
}
async function computeChangePercent(type, nextValue) {
    const prev = await GlobalPrice_1.GlobalPrice.findOne({ type }).sort({ timestamp: -1 }).lean();
    if (!prev || prev.value === 0)
        return 0;
    return round2(((nextValue - prev.value) / prev.value) * 100);
}
async function refreshGlobalPrices(provider, options) {
    const trigger = options?.trigger ?? "cron";
    try {
        const snap = await provider.getLatest();
        const [brentChange, wtiChange, usdChange] = await Promise.all([
            computeChangePercent("Brent", snap.brent),
            computeChangePercent("WTI", snap.wti),
            computeChangePercent("USDPHP", snap.usdphp),
        ]);
        await GlobalPrice_1.GlobalPrice.insertMany([
            { type: "Brent", value: snap.brent, changePercent: brentChange, timestamp: snap.timestamp },
            { type: "WTI", value: snap.wti, changePercent: wtiChange, timestamp: snap.timestamp },
            { type: "USDPHP", value: snap.usdphp, changePercent: usdChange, timestamp: snap.timestamp },
        ]);
        await UpdateLog_1.UpdateLog.create({
            module: "global",
            status: "success",
            message: `Global reference refreshed (${trigger})`,
            timestamp: new Date(),
        });
        return { ok: true };
    }
    catch (err) {
        await UpdateLog_1.UpdateLog.create({
            module: "global",
            status: "failure",
            message: `Global refresh failed (${trigger}): ${err instanceof Error ? err.message : "unknown error"}`,
            timestamp: new Date(),
        });
        return { ok: false };
    }
}
