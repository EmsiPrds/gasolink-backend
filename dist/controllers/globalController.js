"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGlobalLatest = getGlobalLatest;
exports.getGlobalHistory = getGlobalHistory;
const GlobalPrice_1 = require("../models/GlobalPrice");
const globalValidators_1 = require("../validators/globalValidators");
const apiResponse_1 = require("../utils/apiResponse");
const period_1 = require("../utils/period");
async function getGlobalLatest(_req, res) {
    const types = ["Brent", "WTI", "USDPHP"];
    const latest = await Promise.all(types.map(async (type) => {
        const doc = await GlobalPrice_1.GlobalPrice.findOne({ type }).sort({ timestamp: -1 }).lean();
        return doc ?? null;
    }));
    return res.json((0, apiResponse_1.ok)({
        items: latest.filter(Boolean),
    }));
}
async function getGlobalHistory(req, res) {
    const { type, period } = globalValidators_1.GlobalHistoryQuerySchema.parse(req.query);
    const from = (0, period_1.sinceDays)(period);
    const items = await GlobalPrice_1.GlobalPrice.find({
        type,
        timestamp: { $gte: from },
    })
        .sort({ timestamp: 1 })
        .lean();
    return res.json((0, apiResponse_1.ok)({ type, period, items }));
}
