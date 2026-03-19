import type { Request, Response } from "express";
import { Insight } from "../models/Insight";
import { ok } from "../utils/apiResponse";
import { z } from "zod";

const InsightsQuerySchema = z.object({
  active: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? true : v === "true")),
});

export async function getInsights(req: Request, res: Response) {
  const { active } = InsightsQuerySchema.parse(req.query);
  const query = active ? { status: "active" } : {};
  const items = await Insight.find(query).sort({ createdAt: -1 }).limit(50).lean();
  return res.json(ok({ items }));
}

