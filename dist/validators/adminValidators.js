"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminLogsQuerySchema = exports.AdminAlertBodySchema = exports.AdminInsightBodySchema = exports.AdminCompanyPriceBodySchema = exports.AdminPhPriceBodySchema = exports.IdParamSchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("../models/enums");
exports.IdParamSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
});
exports.AdminPhPriceBodySchema = zod_1.z.object({
    fuelType: zod_1.z.enum(enums_1.FuelTypeValues),
    price: zod_1.z.number().finite(),
    weeklyChange: zod_1.z.number().finite(),
    region: zod_1.z.enum(enums_1.RegionValues),
    source: zod_1.z.string().min(1),
    status: zod_1.z.enum(enums_1.PriceStatusValues),
    updatedAt: zod_1.z.coerce.date().optional(),
});
exports.AdminCompanyPriceBodySchema = zod_1.z.object({
    companyName: zod_1.z.string().min(1),
    fuelType: zod_1.z.enum(enums_1.FuelTypeValues),
    price: zod_1.z.number().finite(),
    region: zod_1.z.enum(enums_1.RegionValues),
    city: zod_1.z.string().optional(),
    status: zod_1.z.enum(enums_1.PriceStatusValues),
    source: zod_1.z.string().min(1),
    updatedAt: zod_1.z.coerce.date().optional(),
});
exports.AdminInsightBodySchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    message: zod_1.z.string().min(1),
    category: zod_1.z.string().min(1),
    status: zod_1.z.enum(enums_1.InsightStatusValues).optional(),
});
exports.AdminAlertBodySchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    message: zod_1.z.string().min(1),
    level: zod_1.z.enum(enums_1.AlertLevelValues).optional(),
    active: zod_1.z.boolean().optional(),
});
exports.AdminLogsQuerySchema = zod_1.z.object({
    module: zod_1.z.string().min(1).optional(),
    status: zod_1.z.enum(enums_1.UpdateLogStatusValues).optional(),
});
