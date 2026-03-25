import type { Request, Response } from "express";
import { CompanyPrice } from "../models/CompanyPrice";
import { FinalPublishedFuelPrice } from "../models/FinalPublishedFuelPrice";
import { ok } from "../utils/apiResponse";
import { CompanyQuerySchema } from "../validators/companyValidators";

export async function getCompanyPrices(req: Request, res: Response) {
  const { fuelType, region, company, city } = CompanyQuerySchema.parse(req.query);

  // Prefer accuracy-first published company advisories (reconciled from real ingested sources).
  const publishedQuery: Record<string, unknown> = { displayType: "ph_company" };
  if (fuelType) publishedQuery.fuelType = fuelType;
  if (region) publishedQuery.region = region;
  if (company) publishedQuery.companyName = new RegExp(`^${escapeRegex(company)}$`, "i");
  if (city) publishedQuery.city = new RegExp(escapeRegex(city), "i");

  const published = await FinalPublishedFuelPrice.find(publishedQuery).sort({ updatedAt: -1 }).limit(250).lean();
  if (published.length > 0) {
    const items = published.map((p: any) => ({
      _id: p._id,
      companyName: p.companyName ?? "Unknown",
      fuelType: p.fuelType,
      price: typeof p.finalPrice === "number" ? p.finalPrice : null,
      region: p.region,
      city: p.city,
      status: p.finalStatus,
      source: p.supportingSources?.[0]?.sourceName ?? "Gasolink",
      updatedAt: p.updatedAt,
    }));
    return res.json(ok({ items }));
  }

  // Fallback to legacy admin-managed table.
  const legacyQuery: Record<string, unknown> = {};
  if (fuelType) legacyQuery.fuelType = fuelType;
  if (region) legacyQuery.region = region;
  if (company) legacyQuery.companyName = new RegExp(`^${escapeRegex(company)}$`, "i");
  if (city) legacyQuery.city = new RegExp(escapeRegex(city), "i");

  const items = await CompanyPrice.find(legacyQuery).sort({ updatedAt: -1 }).limit(250).lean();
  return res.json(ok({ items }));
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
