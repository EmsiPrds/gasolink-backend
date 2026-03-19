"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhHistoryQuerySchema = exports.PhLatestQuerySchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("../models/enums");
const period_1 = require("../utils/period");
exports.PhLatestQuerySchema = zod_1.z.object({
    region: zod_1.z.enum(enums_1.RegionValues).optional().default("NCR"),
});
exports.PhHistoryQuerySchema = zod_1.z.object({
    fuelType: zod_1.z.enum(enums_1.FuelTypeValues),
    region: zod_1.z.enum(enums_1.RegionValues).optional().default("NCR"),
    period: period_1.PeriodSchema,
});
