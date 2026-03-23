import { NormalizedFuelRecord } from "../models/NormalizedFuelRecord";
import { FinalPublishedFuelPrice } from "../models/FinalPublishedFuelPrice";
import type { NormalizedFuelRecordDoc } from "../models/NormalizedFuelRecord";
import { UpdateLog } from "../models/UpdateLog";
import { buildFingerprint } from "../normalization/fingerprint";
import { isStale } from "../normalization/staleness";
import { refinePriceWithAi } from "../services/aiService";
import { GlobalPrice } from "../models/GlobalPrice";
import { FuelTypeValues, RegionValues } from "../models/enums";

function sourcePriority(sourceType: NormalizedFuelRecordDoc["sourceType"]): number {
  switch (sourceType) {
    case "official_local":
      return 4;
    case "company_advisory":
      return 3;
    case "observed_station":
      return 2;
    case "estimate":
      return 1;
    case "global_api":
      return 0;
    default: {
      const _exhaustive: never = sourceType;
      return _exhaustive;
    }
  }
}

function buildPublishKey(doc: Pick<NormalizedFuelRecordDoc, "fuelType" | "region" | "city" | "companyName"> & { displayType: string }) {
  return buildFingerprint({
    displayType: doc.displayType,
    fuelType: doc.fuelType,
    region: doc.region,
    city: doc.city ?? "",
    companyName: doc.companyName ?? "",
  });
}

export async function reconcileFuelRecords(params?: { sinceMinutes?: number }) {
  const now = new Date();
  const sinceMinutes = params?.sinceMinutes ?? 180;
  const from = new Date(now.getTime() - sinceMinutes * 60_000);

  const candidates = await NormalizedFuelRecord.find({ 
    updatedAt: { $gte: from },
    $or: [
        { effectiveAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
        { sourcePublishedAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
    ]
  }).sort({ confidenceScore: -1 }).lean();

  // Group by fuelType+region+city+companyName.
  // This avoids mixing "official regional" with "company advisory" with "observed station" into a single competition.
  const groups = new Map<string, NormalizedFuelRecordDoc[]>();
  for (const c of candidates) {
    const key = `${c.fuelType}::${c.region}::${c.city ?? ""}::${c.companyName ?? ""}`;
    const arr = groups.get(key) ?? [];
    arr.push(c as NormalizedFuelRecordDoc);
    groups.set(key, arr);
  }

  let upserted = 0;
  for (const [, items] of groups) {
    const sorted = items
      .slice()
      .sort((a, b) => {
        const ap = sourcePriority(a.sourceType);
        const bp = sourcePriority(b.sourceType);
        if (ap !== bp) return bp - ap;
        if (a.confidenceScore !== b.confidenceScore) return b.confidenceScore - a.confidenceScore;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

    const winner = sorted[0];
    if (!winner) continue;

    // Calculate average price from all candidates with a pricePerLiter
    const itemsWithPrice = items.filter((item) => typeof item.pricePerLiter === "number");
    const averagePrice =
      itemsWithPrice.length > 0
        ? itemsWithPrice.reduce((sum, item) => sum + (item.pricePerLiter ?? 0), 0) / itemsWithPrice.length
        : null;

    const displayType =
      winner.sourceType === "company_advisory"
        ? "ph_company"
        : winner.sourceType === "observed_station"
          ? "ph_observed"
          : "ph_final";
    const publishKey = buildPublishKey({
      displayType,
      fuelType: winner.fuelType,
      region: winner.region,
      city: winner.city,
      companyName: winner.companyName,
    });

    const supportingSources = sorted.slice(0, 5).map((s) => ({
      normalizedRecordId: (s as any)._id,
      sourceType: s.sourceType,
      sourceName: s.sourceName,
      sourceUrl: s.sourceUrl,
      sourcePublishedAt: s.sourcePublishedAt,
      scrapedAt: s.scrapedAt,
      parserVersion: "v1",
      confidenceScore: s.confidenceScore,
      statusLabel: s.statusLabel,
    }));

    const lastVerifiedAt = winner.sourcePublishedAt ?? winner.scrapedAt ?? winner.updatedAt ?? now;

    let finalPrice = typeof winner.pricePerLiter === "number" ? winner.pricePerLiter : null;

    // If we have a priceChange but not a final price, estimate it from the last known price
    if (finalPrice === null && typeof winner.priceChange === "number") {
      const lastPriceDoc = await FinalPublishedFuelPrice.findOne(
        {
          fuelType: winner.fuelType,
          region: winner.region,
          finalPrice: { $ne: null },
        },
        { finalPrice: 1 },
      ).sort({ lastVerifiedAt: -1 });

      if (lastPriceDoc && typeof lastPriceDoc.finalPrice === "number") {
        finalPrice = lastPriceDoc.finalPrice + winner.priceChange;
      } else {
        // Fallback to baseline prices if no history exists (approximate PH prices as of March 2026)
        const baseline: Record<string, number> = {
          Gasoline: 65.5,
          Diesel: 58.2,
          Kerosene: 72.4,
        };
        const base = baseline[winner.fuelType] ?? 60;
        finalPrice = base + winner.priceChange;
      }
    }

    // Staleness gating (fail closed): do not publish stale advisory/observed/estimate.
    if (isStale(winner.sourceType, new Date(lastVerifiedAt), now) && winner.sourceType !== "official_local") {
      continue;
    }

    await FinalPublishedFuelPrice.findOneAndUpdate(
      { publishKey },
      {
        displayType,
        companyName: winner.companyName,
        fuelType: winner.fuelType,
        region: winner.region,
        city: winner.city,
        finalPrice: finalPrice,
        averagePrice: averagePrice ?? null,
        priceChange: winner.priceChange,
        currency: winner.currency ?? "PHP",
        supportingSources,
        finalStatus: winner.statusLabel,
        confidenceScore: winner.confidenceScore,
        lastVerifiedAt,
        updatedAt: now,
        publishKey,
      },
      { upsert: true, new: true },
    );
    upserted += 1;
  }

  await UpdateLog.create({
    module: "reconciliation",
    status: "success",
    message: `Reconciliation complete. groups=${groups.size} upserted=${upserted}`,
    timestamp: now,
  });

  return { ok: true as const, groups: groups.size, upserted };
}

