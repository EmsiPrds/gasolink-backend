"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPhLatest = getPhLatest;
exports.getPhHistory = getPhHistory;
const FuelPricePH_1 = require("../models/FuelPricePH");
const FinalPublishedFuelPrice_1 = require("../models/FinalPublishedFuelPrice");
const apiResponse_1 = require("../utils/apiResponse");
const period_1 = require("../utils/period");
const phValidators_1 = require("../validators/phValidators");
async function getPhLatest(req, res) {
    const { region } = phValidators_1.PhLatestQuerySchema.parse(req.query);
    // Prefer accuracy-first published records; fall back to legacy table if none exist.
    const published = await FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.aggregate([
        { $match: { region, displayType: "ph_final", confidenceScore: { $gte: 0.35 } } },
        { $sort: { updatedAt: -1 } },
        { $group: { _id: "$fuelType", doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } },
    ]);
    const items = published.length > 0
        ? published.map((p) => ({
            // Shape-compat response for current frontend until it’s upgraded:
            _id: p._id,
            fuelType: p.fuelType,
            price: typeof p.finalPrice === "number" ? p.finalPrice : null,
            averagePrice: typeof p.averagePrice === "number" ? p.averagePrice : null,
            weeklyChange: typeof p.priceChange === "number" ? p.priceChange : 0,
            region: p.region,
            source: p.supportingSources?.[0]?.sourceName ?? "Gasolink",
            status: p.finalStatus, // Verified/Official/Advisory/Observed/Estimate (frontend will be upgraded soon)
            updatedAt: p.updatedAt,
            // extra fields for upgraded UI (safe to include)
            confidenceScore: p.confidenceScore,
            lastVerifiedAt: p.lastVerifiedAt,
            supportingSources: p.supportingSources,
        }))
        : await FuelPricePH_1.FuelPricePH.aggregate([
            { $match: { region } },
            { $sort: { updatedAt: -1 } },
            { $group: { _id: "$fuelType", doc: { $first: "$$ROOT" } } },
            { $replaceRoot: { newRoot: "$doc" } },
        ]);
    return res.json((0, apiResponse_1.ok)({ region, items }));
}
async function getPhHistory(req, res) {
    const { fuelType, region, period } = phValidators_1.PhHistoryQuerySchema.parse(req.query);
    const from = (0, period_1.sinceDays)(period);
    // Prefer published history; fallback to legacy history.
    const published = await FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.find({
        fuelType,
        region,
        updatedAt: { $gte: from },
        displayType: "ph_final",
        confidenceScore: { $gte: 0.35 },
    })
        .sort({ updatedAt: 1 })
        .lean();
    const items = published.length > 0
        ? published.map((p) => ({
            _id: p._id,
            fuelType: p.fuelType,
            price: typeof p.finalPrice === "number" ? p.finalPrice : null,
            averagePrice: typeof p.averagePrice === "number" ? p.averagePrice : null,
            weeklyChange: typeof p.priceChange === "number" ? p.priceChange : 0,
            region: p.region,
            source: p.supportingSources?.[0]?.sourceName ?? "Gasolink",
            status: p.finalStatus,
            updatedAt: p.updatedAt,
            confidenceScore: p.confidenceScore,
            lastVerifiedAt: p.lastVerifiedAt,
        }))
        : await FuelPricePH_1.FuelPricePH.find({
            fuelType,
            region,
            updatedAt: { $gte: from },
        })
            .sort({ updatedAt: 1 })
            .lean();
    return res.json((0, apiResponse_1.ok)({ fuelType, region, period, items }));
}
