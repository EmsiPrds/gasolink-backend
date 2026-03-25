"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompanyPrices = getCompanyPrices;
const CompanyPrice_1 = require("../models/CompanyPrice");
const FinalPublishedFuelPrice_1 = require("../models/FinalPublishedFuelPrice");
const apiResponse_1 = require("../utils/apiResponse");
const companyValidators_1 = require("../validators/companyValidators");
async function getCompanyPrices(req, res) {
    const { fuelType, region, company, city } = companyValidators_1.CompanyQuerySchema.parse(req.query);
    // Prefer accuracy-first published company advisories (reconciled from real ingested sources).
    const publishedQuery = { displayType: "ph_company" };
    if (fuelType)
        publishedQuery.fuelType = fuelType;
    if (region)
        publishedQuery.region = region;
    if (company)
        publishedQuery.companyName = new RegExp(`^${escapeRegex(company)}$`, "i");
    if (city)
        publishedQuery.city = new RegExp(escapeRegex(city), "i");
    const published = await FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.find(publishedQuery).sort({ updatedAt: -1 }).limit(250).lean();
    if (published.length > 0) {
        const items = published.map((p) => ({
            _id: p._id,
            companyName: p.companyName ?? "Unknown",
            fuelType: p.fuelType,
            price: typeof p.finalPrice === "number" ? p.finalPrice : null,
            region: p.region,
            city: p.city,
            status: p.finalStatus,
            source: p.supportingSources?.[0]?.sourceName ?? "Gasolink",
            updatedAt: p.updatedAt,
        }));
        return res.json((0, apiResponse_1.ok)({ items }));
    }
    // Fallback to legacy admin-managed table.
    const legacyQuery = {};
    if (fuelType)
        legacyQuery.fuelType = fuelType;
    if (region)
        legacyQuery.region = region;
    if (company)
        legacyQuery.companyName = new RegExp(`^${escapeRegex(company)}$`, "i");
    if (city)
        legacyQuery.city = new RegExp(escapeRegex(city), "i");
    const items = await CompanyPrice_1.CompanyPrice.find(legacyQuery).sort({ updatedAt: -1 }).limit(250).lean();
    return res.json((0, apiResponse_1.ok)({ items }));
}
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
