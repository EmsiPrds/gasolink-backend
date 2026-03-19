import type { Request, Response } from "express";
import { GlobalPrice } from "../models/GlobalPrice";
import { GlobalHistoryQuerySchema } from "../validators/globalValidators";
import { ok } from "../utils/apiResponse";
import { sinceDays } from "../utils/period";

export async function getGlobalLatest(_req: Request, res: Response) {
  const types = ["Brent", "WTI", "USDPHP"] as const;
  const latest = await Promise.all(
    types.map(async (type) => {
      const doc = await GlobalPrice.findOne({ type }).sort({ timestamp: -1 }).lean();
      return doc ?? null;
    }),
  );

  return res.json(
    ok({
      items: latest.filter(Boolean),
    }),
  );
}

export async function getGlobalHistory(req: Request, res: Response) {
  const { type, period } = GlobalHistoryQuerySchema.parse(req.query);
  const from = sinceDays(period);

  const items = await GlobalPrice.find({
    type,
    timestamp: { $gte: from },
  })
    .sort({ timestamp: 1 })
    .lean();

  return res.json(ok({ type, period, items }));
}

