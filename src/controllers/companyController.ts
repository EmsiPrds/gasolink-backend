import type { Request, Response } from "express";
import { CompanyPrice } from "../models/CompanyPrice";
import { ok } from "../utils/apiResponse";
import { CompanyQuerySchema } from "../validators/companyValidators";

export async function getCompanyPrices(req: Request, res: Response) {
  const { fuelType, region, company, city } = CompanyQuerySchema.parse(req.query);

  const query: Record<string, unknown> = {};
  if (fuelType) query.fuelType = fuelType;
  if (region) query.region = region;
  if (company) query.companyName = new RegExp(`^${escapeRegex(company)}$`, "i");
  if (city) query.city = new RegExp(escapeRegex(city), "i");

  const items = await CompanyPrice.find(query).sort({ updatedAt: -1 }).limit(250).lean();

  return res.json(ok({ items }));
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

