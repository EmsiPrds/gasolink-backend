"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAlerts = getAlerts;
const Alert_1 = require("../models/Alert");
const apiResponse_1 = require("../utils/apiResponse");
const zod_1 = require("zod");
const AlertsQuerySchema = zod_1.z.object({
    active: zod_1.z
        .union([zod_1.z.literal("true"), zod_1.z.literal("false")])
        .optional()
        .transform((v) => (v === undefined ? true : v === "true")),
});
async function getAlerts(req, res) {
    const { active } = AlertsQuerySchema.parse(req.query);
    const query = active ? { active: true } : {};
    const items = await Alert_1.Alert.find(query).sort({ createdAt: -1 }).limit(50).lean();
    return res.json((0, apiResponse_1.ok)({ items }));
}
