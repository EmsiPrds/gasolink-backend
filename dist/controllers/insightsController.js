"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInsights = getInsights;
const Insight_1 = require("../models/Insight");
const apiResponse_1 = require("../utils/apiResponse");
const zod_1 = require("zod");
const InsightsQuerySchema = zod_1.z.object({
    active: zod_1.z
        .union([zod_1.z.literal("true"), zod_1.z.literal("false")])
        .optional()
        .transform((v) => (v === undefined ? true : v === "true")),
});
async function getInsights(req, res) {
    const { active } = InsightsQuerySchema.parse(req.query);
    const query = active ? { status: "active" } : {};
    const items = await Insight_1.Insight.find(query).sort({ createdAt: -1 }).limit(50).lean();
    return res.json((0, apiResponse_1.ok)({ items }));
}
