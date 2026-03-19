"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeriodSchema = void 0;
exports.sinceDays = sinceDays;
const zod_1 = require("zod");
exports.PeriodSchema = zod_1.z
    .union([zod_1.z.literal("7"), zod_1.z.literal("30"), zod_1.z.literal("90"), zod_1.z.number()])
    .optional()
    .transform((v) => {
    const n = typeof v === "number" ? v : v ? Number(v) : 30;
    if (![7, 30, 90].includes(n))
        return 30;
    return n;
});
function sinceDays(days) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    d.setHours(0, 0, 0, 0);
    return d;
}
