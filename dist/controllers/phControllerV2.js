"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPhLatest = getPhLatest;
exports.getPhHistory = getPhHistory;
exports.getPhObserved = getPhObserved;
exports.getPhSourceDetails = getPhSourceDetails;
const apiResponse_1 = require("../utils/apiResponse");
const FinalPublishedFuelPrice_1 = require("../models/FinalPublishedFuelPrice");
const FuelPricePH_1 = require("../models/FuelPricePH");
const NormalizedFuelRecord_1 = require("../models/NormalizedFuelRecord");
const RawScrapedSource_1 = require("../models/RawScrapedSource");
const enums_1 = require("../models/enums");
const period_1 = require("../utils/period");
const phValidators_1 = require("../validators/phValidators");
const zod_1 = require("zod");
function toLegacyPhShape(p) {
    return {
        _id: p._id,
        fuelType: p.fuelType,
        price: typeof p.finalPrice === "number" ? p.finalPrice : 0,
        weeklyChange: typeof p.priceChange === "number" ? p.priceChange : 0,
        region: p.region,
        source: p.supportingSources?.[0]?.sourceName ?? "Gasolink",
        status: p.finalStatus,
        updatedAt: p.updatedAt,
        confidenceScore: p.confidenceScore,
        lastVerifiedAt: p.lastVerifiedAt,
        supportingSources: p.supportingSources,
    };
}
async function getPhLatest(req, res) {
    const { region } = phValidators_1.PhLatestQuerySchema.parse(req.query);
    const published = await FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.aggregate([
        // "Latest PH prices" on the dashboard is intended to be the regional headline price,
        // not company-specific advisories nor city/station observations.
        { $match: { region, displayType: "ph_final", companyName: { $in: [null, ""] }, city: { $in: [null, ""] } } },
        { $sort: { updatedAt: -1 } },
        { $group: { _id: "$fuelType", doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } },
    ]);
    const publishedItems = published.map(toLegacyPhShape);
    const publishedByFuel = new Map(publishedItems.map((i) => [i.fuelType, i]));
    // If the accuracy-first pipeline hasn't published all fuel types yet, fall back to legacy table for missing ones.
    if (publishedByFuel.size < enums_1.FuelTypeValues.length) {
        const legacy = await FuelPricePH_1.FuelPricePH.aggregate([
            { $match: { region } },
            { $sort: { updatedAt: -1 } },
            { $group: { _id: "$fuelType", doc: { $first: "$$ROOT" } } },
            { $replaceRoot: { newRoot: "$doc" } },
        ]);
        for (const l of legacy) {
            if (!publishedByFuel.has(l.fuelType))
                publishedByFuel.set(l.fuelType, l);
        }
    }
    const items = enums_1.FuelTypeValues.map((ft) => publishedByFuel.get(ft)).filter(Boolean);
    return res.json((0, apiResponse_1.ok)({ region, items }));
}
async function getPhHistory(req, res) {
    const { fuelType, region, period } = phValidators_1.PhHistoryQuerySchema.parse(req.query);
    const from = (0, period_1.sinceDays)(period);
    const published = await FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.find({
        fuelType,
        region,
        updatedAt: { $gte: from },
        displayType: "ph_final",
        companyName: { $in: [null, ""] },
        city: { $in: [null, ""] },
    })
        .sort({ updatedAt: 1 })
        .lean();
    const items = published.length > 0
        ? published.map(toLegacyPhShape)
        : await FuelPricePH_1.FuelPricePH.find({
            fuelType,
            region,
            updatedAt: { $gte: from },
        })
            .sort({ updatedAt: 1 })
            .lean();
    return res.json((0, apiResponse_1.ok)({ fuelType, region, period, items }));
}
const ObservedQuerySchema = zod_1.z.object({
    region: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    fuelType: zod_1.z.string().optional(),
});
async function getPhObserved(req, res) {
    const { region, city, fuelType } = ObservedQuerySchema.parse(req.query);
    const q = { sourceType: "observed_station" };
    if (region)
        q.region = region;
    if (city)
        q.city = new RegExp(city, "i");
    if (fuelType)
        q.fuelType = fuelType;
    const items = await NormalizedFuelRecord_1.NormalizedFuelRecord.find(q).sort({ scrapedAt: -1 }).limit(250).lean();
    return res.json((0, apiResponse_1.ok)({ items }));
}
const SourceDetailsParamSchema = zod_1.z.object({ id: zod_1.z.string().min(1) });
async function getPhSourceDetails(req, res) {
    const { id } = SourceDetailsParamSchema.parse(req.params);
    // Try to interpret :id as a RawScrapedSource id first, then Normalized, then Published.
    const [raw, normalized, published] = await Promise.all([
        RawScrapedSource_1.RawScrapedSource.findById(id).lean(),
        NormalizedFuelRecord_1.NormalizedFuelRecord.findById(id).lean(),
        FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.findById(id).lean(),
    ]);
    return res.json((0, apiResponse_1.ok)({ raw: raw ?? null, normalized: normalized ?? null, published: published ?? null }));
}
