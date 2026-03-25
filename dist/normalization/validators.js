"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NormalizedCandidateSchema = void 0;
exports.validateCandidate = validateCandidate;
const zod_1 = require("zod");
const enums_1 = require("../models/enums");
exports.NormalizedCandidateSchema = zod_1.z.object({
    sourceType: zod_1.z.enum(enums_1.SourceTypeValues),
    statusLabel: zod_1.z.enum(enums_1.StatusLabelValues),
    confidenceScore: zod_1.z.number().min(0).max(1),
    companyName: zod_1.z.string().min(1).nullish(),
    stationName: zod_1.z.string().min(1).nullish(),
    fuelType: zod_1.z.enum(enums_1.FuelTypeValues),
    productName: zod_1.z.string().min(1).nullish(),
    region: zod_1.z.enum(enums_1.RegionValues),
    city: zod_1.z.string().min(1).nullish(),
    pricePerLiter: zod_1.z.number().min(0).nullish(),
    priceChange: zod_1.z.number().nullish(),
    currency: zod_1.z.literal("PHP"),
    sourceName: zod_1.z.string().min(1),
    sourceUrl: zod_1.z.string().url(),
    sourcePublishedAt: zod_1.z.coerce.date().nullish(),
    scrapedAt: zod_1.z.coerce.date(),
    effectiveAt: zod_1.z.coerce.date().nullish(),
});
function validateCandidate(candidate) {
    return exports.NormalizedCandidateSchema.parse(candidate);
}
