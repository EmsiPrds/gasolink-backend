"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getForecast = getForecast;
const apiResponse_1 = require("../utils/apiResponse");
const zod_1 = require("zod");
const enums_1 = require("../models/enums");
const forecastService_1 = require("../services/forecastService");
const ForecastQuerySchema = zod_1.z.object({
    region: zod_1.z.enum(enums_1.RegionValues).optional().default("NCR"),
});
async function getForecast(req, res) {
    const { region } = ForecastQuerySchema.parse(req.query);
    const data = await (0, forecastService_1.buildForecast)(region);
    return res.json((0, apiResponse_1.ok)(data));
}
