import type { Request, Response } from "express";
import { Alert } from "../models/Alert";
import { ok } from "../utils/apiResponse";
import { z } from "zod";

const AlertsQuerySchema = z.object({
  active: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? true : v === "true")),
});

export async function getAlerts(req: Request, res: Response) {
  const { active } = AlertsQuerySchema.parse(req.query);
  const query = active ? { active: true } : {};
  const items = await Alert.find(query).sort({ createdAt: -1 }).limit(50).lean();
  return res.json(ok({ items }));
}

