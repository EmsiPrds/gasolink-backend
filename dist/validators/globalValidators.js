"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalHistoryQuerySchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("../models/enums");
const period_1 = require("../utils/period");
exports.GlobalHistoryQuerySchema = zod_1.z.object({
    type: zod_1.z.enum(enums_1.GlobalPriceTypeValues),
    period: period_1.PeriodSchema,
});
