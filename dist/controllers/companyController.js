"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompanyPrices = getCompanyPrices;
const CompanyPrice_1 = require("../models/CompanyPrice");
const apiResponse_1 = require("../utils/apiResponse");
const companyValidators_1 = require("../validators/companyValidators");
async function getCompanyPrices(req, res) {
    const { fuelType, region, company, city } = companyValidators_1.CompanyQuerySchema.parse(req.query);
    const query = {};
    if (fuelType)
        query.fuelType = fuelType;
    if (region)
        query.region = region;
    if (company)
        query.companyName = new RegExp(`^${escapeRegex(company)}$`, "i");
    if (city)
        query.city = new RegExp(escapeRegex(city), "i");
    const items = await CompanyPrice_1.CompanyPrice.find(query).sort({ updatedAt: -1 }).limit(250).lean();
    return res.json((0, apiResponse_1.ok)({ items }));
}
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
