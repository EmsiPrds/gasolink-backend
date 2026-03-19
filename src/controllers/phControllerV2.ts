import type { Request, Response } from "express";
import { ok } from "../utils/apiResponse";
import { FinalPublishedFuelPrice } from "../models/FinalPublishedFuelPrice";
import { FuelPricePH } from "../models/FuelPricePH";
import { NormalizedFuelRecord } from "../models/NormalizedFuelRecord";
import { RawScrapedSource } from "../models/RawScrapedSource";
import { FuelTypeValues } from "../models/enums";
import { sinceDays } from "../utils/period";
import { PhHistoryQuerySchema, PhLatestQuerySchema } from "../validators/phValidators";
import { z } from "zod";

function toLegacyPhShape(p: any) {
  return {
    _id: p._id,
    fuelType: p.fuelType,
    price: typeof p.finalPrice === "number" ? p.finalPrice : 0,
    weeklyChange: typeof p.priceChange === "number" ? p.priceChange : 0,
    region: p.region,
    source: p.supportingSources?.[0]?.sourceName ?? "Gasolink",
    status: p.finalStatus,
    updatedAt: p.updatedAt,
    confidenceScore: p.confidenceScore,
    lastVerifiedAt: p.lastVerifiedAt,
    supportingSources: p.supportingSources,
  };
}

export async function getPhLatest(req: Request, res: Response) {
  const { region } = PhLatestQuerySchema.parse(req.query);

  const published = await FinalPublishedFuelPrice.aggregate([
    // "Latest PH prices" on the dashboard is intended to be the regional headline price,
    // not company-specific advisories nor city/station observations.
    { $match: { region, displayType: "ph_final", companyName: { $in: [null, ""] }, city: { $in: [null, ""] } } },
    { $sort: { updatedAt: -1 } },
    { $group: { _id: "$fuelType", doc: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$doc" } },
  ]);

  const publishedItems = published.map(toLegacyPhShape);
  const publishedByFuel = new Map(publishedItems.map((i: any) => [i.fuelType, i]));

  // If the accuracy-first pipeline hasn't published all fuel types yet, fall back to legacy table for missing ones.
  if (publishedByFuel.size < FuelTypeValues.length) {
    const legacy = await FuelPricePH.aggregate([
      { $match: { region } },
      { $sort: { updatedAt: -1 } },
      { $group: { _id: "$fuelType", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
    ]);
    for (const l of legacy) {
      if (!publishedByFuel.has(l.fuelType)) publishedByFuel.set(l.fuelType, l);
    }
  }

  const items = FuelTypeValues.map((ft) => publishedByFuel.get(ft)).filter(Boolean);
  return res.json(ok({ region, items }));
}

export async function getPhHistory(req: Request, res: Response) {
  const { fuelType, region, period } = PhHistoryQuerySchema.parse(req.query);
  const from = sinceDays(period);

  const published = await FinalPublishedFuelPrice.find({
    fuelType,
    region,
    updatedAt: { $gte: from },
    displayType: "ph_final",
    companyName: { $in: [null, ""] },
    city: { $in: [null, ""] },
  })
    .sort({ updatedAt: 1 })
    .lean();

  const items =
    published.length > 0
      ? published.map(toLegacyPhShape)
      : await FuelPricePH.find({
          fuelType,
          region,
          updatedAt: { $gte: from },
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

