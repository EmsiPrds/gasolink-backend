"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyQuerySchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("../models/enums");
exports.CompanyQuerySchema = zod_1.z.object({
    fuelType: zod_1.z.enum(enums_1.FuelTypeValues).optional(),
    region: zod_1.z.enum(enums_1.RegionValues).optional(),
    company: zod_1.z.string().trim().min(1).optional(),
    city: zod_1.z.string().trim().min(1).optional(),
});
