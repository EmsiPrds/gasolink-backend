"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildForecast = buildForecast;
const GlobalPrice_1 = require("../models/GlobalPrice");
const FuelPricePH_1 = require("../models/FuelPricePH");
const enums_1 = require("../models/enums");
function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
async function getPctChange(type, days) {
    const latest = await GlobalPrice_1.GlobalPrice.findOne({ type }).sort({ timestamp: -1 }).lean();
    if (!latest)
        return { latest: null, pct: 0 };
    const from = new Date(latest.timestamp);
    from.setDate(from.getDate() - days);
    const past = await GlobalPrice_1.GlobalPrice.findOne({ type, timestamp: { $lte: from } })
        .sort({ timestamp: -1 })
        .lean();
    if (!past)
        return { latest, pct: 0 };
    const pct = ((latest.value - past.value) / past.value) * 100;
    return { latest, pct };
}
async function buildForecast(region) {
    const [{ pct: brent7dPct }, { pct: wti7dPct }, { pct: usdphp7dPct }] = await Promise.all([getPctChange("Brent", 7), getPctChange("WTI", 7), getPctChange("USDPHP", 7)]);
    const score = brent7dPct * 0.5 + wti7dPct * 0.3 + usdphp7dPct * 0.2;
    const estimated = clamp(score * 0.15, -3, 3);
    const latestPh = await FuelPricePH_1.FuelPricePH.aggregate([
        { $match: { region } },
        { $sort: { updatedAt: -1 } },
        { $group: { _id: "$fuelType", doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } },
    ]);
    const cards = enums_1.FuelTypeValues.map((fuelType) => {
        const baseWeekly = latestPh.find((x) => x.fuelType === fuelType)?.weeklyChange ?? 0;
        const blended = clamp(baseWeekly * 0.35 + estimated * 0.65, -4, 4);
        const direction = Math.abs(blended) < 0.25 ? "flat" : blended > 0 ? "up" : "down";
        const message = direction === "flat"
            ? "Global movement looks mild. Local prices may stay close to current levels, but the weekly update can still change."
            : direction === "up"
                ? "Global reference is trending up. Local prices may increase in the next adjustment window."
                : "Global reference is trending down. Local prices may ease in the next adjustment window.";
        return {
            fuelType,
            estimatedWeeklyChange: round2(blended),
            direction,
            label: "Estimate only – not official",
            message,
            basedOn: {
                brent7dPct: round2(brent7dPct),
                wti7dPct: round2(wti7dPct),
                usdphp7dPct: round2(usdphp7dPct),
            },
        };
    });
    return { region, cards };
}
