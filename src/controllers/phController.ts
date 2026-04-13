import type { Request, Response } from "express";
import { FuelPricePH } from "../models/FuelPricePH";
import { FinalPublishedFuelPrice } from "../models/FinalPublishedFuelPrice";
import { ok } from "../utils/apiResponse";
import { sinceDays } from "../utils/period";
import { PhHistoryQuerySchema, PhLatestQuerySchema } from "../validators/phValidators";

export async function getPhLatest(req: Request, res: Response) {
  const { region } = PhLatestQuerySchema.parse(req.query);

  // Prefer accuracy-first published records; fall back to legacy table if none exist.
  const published = await FinalPublishedFuelPrice.aggregate([
    { $match: { region, displayType: "ph_final", confidenceScore: { $gte: 0.35 } } },
    {
      $addFields: {
        _statusPriority: {
          $cond: [{ $eq: ["$finalStatus", "Official"] }, 2, { $cond: [{ $eq: ["$finalStatus", "Verified"] }, 1, 0] }],
        },
      },
    },
    { $sort: { _statusPriority: -1, confidenceScore: -1, updatedAt: -1 } },
    { $group: { _id: "$fuelType", doc: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$doc" } },
  ]);
  const publishedWithRegion =
    published.length > 0
      ? published
      : await FinalPublishedFuelPrice.aggregate([
          { $match: { displayType: "ph_final", confidenceScore: { $gte: 0.35 } } },
          {
            $addFields: {
              _statusPriority: {
                $cond: [{ $eq: ["$finalStatus", "Official"] }, 2, { $cond: [{ $eq: ["$finalStatus", "Verified"] }, 1, 0] }],
              },
            },
          },
          { $sort: { _statusPriority: -1, confidenceScore: -1, updatedAt: -1 } },
          { $group: { _id: "$fuelType", doc: { $first: "$$ROOT" } } },
          { $replaceRoot: { newRoot: "$doc" } },
        ]);

  const items =
    publishedWithRegion.length > 0
      ? publishedWithRegion.map((p: any) => ({
          // Shape-compat response for current frontend until it’s upgraded:
          _id: p._id,
          fuelType: p.fuelType,
          price: typeof p.finalPrice === "number" ? p.finalPrice : null,
          averagePrice: typeof p.averagePrice === "number" ? p.averagePrice : null,
          weeklyChange: typeof p.priceChange === "number" ? p.priceChange : 0,
          region: p.region,
          source: p.supportingSources?.[0]?.sourceName ?? "Gasolink",
          status: p.finalStatus, // Verified/Official/Advisory/Observed/Estimate (frontend will be upgraded soon)
          updatedAt: p.updatedAt,
          // extra fields for upgraded UI (safe to include)
          confidenceScore: p.confidenceScore,
          lastVerifiedAt: p.lastVerifiedAt,
          supportingSources: p.supportingSources,
        }))
      : await FuelPricePH.aggregate([
          { $match: { region } },
          { $sort: { updatedAt: -1 } },
          { $group: { _id: "$fuelType", doc: { $first: "$$ROOT" } } },
          { $replaceRoot: { newRoot: "$doc" } },
        ]);

  return res.json(ok({ region, items }));
}

export async function getPhHistory(req: Request, res: Response) {
  const { fuelType, region, period } = PhHistoryQuerySchema.parse(req.query);
  const from = sinceDays(period);

  // Prefer published history; fallback to legacy history.
  const published = await FinalPublishedFuelPrice.find({
    fuelType,
    region,
    updatedAt: { $gte: from },
    displayType: "ph_final",
    confidenceScore: { $gte: 0.35 },
  })
    .sort({ updatedAt: 1 })
    .lean();
  const publishedWithRegion =
    published.length > 0
      ? published
      : await FinalPublishedFuelPrice.find({
          fuelType,
          updatedAt: { $gte: from },
          displayType: "ph_final",
          confidenceScore: { $gte: 0.35 },
        })
          .sort({ updatedAt: 1 })
          .lean();

  const items =
    publishedWithRegion.length > 0
      ? publishedWithRegion.map((p: any) => ({
          _id: p._id,
          fuelType: p.fuelType,
          price: typeof p.finalPrice === "number" ? p.finalPrice : null,
          averagePrice: typeof p.averagePrice === "number" ? p.averagePrice : null,
          weeklyChange: typeof p.priceChange === "number" ? p.priceChange : 0,
          region: p.region,
          source: p.supportingSources?.[0]?.sourceName ?? "Gasolink",
          status: p.finalStatus,
          updatedAt: p.updatedAt,
          confidenceScore: p.confidenceScore,
          lastVerifiedAt: p.lastVerifiedAt,
        }))
      : await FuelPricePH.find({
          fuelType,
          region,
          updatedAt: { $gte: from },
        })
          .sort({ updatedAt: 1 })
          .lean();

  return res.json(ok({ fuelType, region, period, items }));
}

