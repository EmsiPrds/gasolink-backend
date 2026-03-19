import type { Request, Response } from "express";
import { ok } from "../utils/apiResponse";
import { FinalPublishedFuelPrice } from "../models/FinalPublishedFuelPrice";
import { NormalizedFuelRecord } from "../models/NormalizedFuelRecord";
import { RawScrapedSource } from "../models/RawScrapedSource";
import { sinceDays } from "../utils/period";
import { PhHistoryQuerySchema, PhLatestQuerySchema } from "../validators/phValidators";
import { z } from "zod";

export async function getPhLatest(req: Request, res: Response) {
  const { region } = PhLatestQuerySchema.parse(req.query);

  const published = await FinalPublishedFuelPrice.aggregate([
    { $match: { region, displayType: "ph_final" } },
    { $sort: { updatedAt: -1 } },
    { $group: { _id: "$fuelType", doc: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$doc" } },
  ]);

  return res.json(ok({ region, items: published }));
}

export async function getPhHistory(req: Request, res: Response) {
  const { fuelType, region, period } = PhHistoryQuerySchema.parse(req.query);
  const from = sinceDays(period);

  const items = await FinalPublishedFuelPrice.find({
    fuelType,
    region,
    updatedAt: { $gte: from },
    displayType: "ph_final",
  })
    .sort({ updatedAt: 1 })
    .lean();

  return res.json(ok({ fuelType, region, period, items }));
}

const ObservedQuerySchema = z.object({
  region: z.string().optional(),
  city: z.string().optional(),
  fuelType: z.string().optional(),
});

export async function getPhObserved(req: Request, res: Response) {
  const { region, city, fuelType } = ObservedQuerySchema.parse(req.query);
  const q: Record<string, unknown> = { sourceType: "observed_station" };
  if (region) q.region = region;
  if (city) q.city = new RegExp(city, "i");
  if (fuelType) q.fuelType = fuelType;

  const items = await NormalizedFuelRecord.find(q).sort({ scrapedAt: -1 }).limit(250).lean();
  return res.json(ok({ items }));
}

const SourceDetailsParamSchema = z.object({ id: z.string().min(1) });

export async function getPhSourceDetails(req: Request, res: Response) {
  const { id } = SourceDetailsParamSchema.parse(req.params);

  // Try to interpret :id as a RawScrapedSource id first, then Normalized, then Published.
  const [raw, normalized, published] = await Promise.all([
    RawScrapedSource.findById(id).lean(),
    NormalizedFuelRecord.findById(id).lean(),
    FinalPublishedFuelPrice.findById(id).lean(),
  ]);

  return res.json(ok({ raw: raw ?? null, normalized: normalized ?? null, published: published ?? null }));
}

