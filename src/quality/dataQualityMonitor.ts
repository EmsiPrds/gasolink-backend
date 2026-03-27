import { Alert } from "../models/Alert";
import { FinalPublishedFuelPrice } from "../models/FinalPublishedFuelPrice";
import { NormalizedFuelRecord } from "../models/NormalizedFuelRecord";
import { RawScrapedSource } from "../models/RawScrapedSource";
import { UpdateLog } from "../models/UpdateLog";
import { FuelTypeValues } from "../models/enums";
import { isStale } from "../normalization/staleness";

async function upsertActiveAlert(params: {
  title: string;
  message: string;
  level: "info" | "warning" | "critical";
  createdAt: Date;
}) {
  await Alert.findOneAndUpdate(
    { title: params.title, active: true },
    {
      $set: {
        message: params.message,
        level: params.level,
        createdAt: params.createdAt,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
}

export async function runDataQualityMonitor() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [rawFailed, normalizedCount, recentOfficialCoverage, latestOfficialHeadline] = await Promise.all([
    RawScrapedSource.countDocuments({ processingStatus: "failed" }),
    NormalizedFuelRecord.countDocuments({}),
    FinalPublishedFuelPrice.countDocuments({
      displayType: "ph_final",
      companyName: { $in: [null, ""] },
      city: { $in: [null, ""] },
      lastVerifiedAt: { $gte: sevenDaysAgo },
    }),
    FinalPublishedFuelPrice.findOne({
      displayType: "ph_final",
      companyName: { $in: [null, ""] },
      city: { $in: [null, ""] },
    })
      .sort({ lastVerifiedAt: -1 })
      .select({ lastVerifiedAt: 1, fuelType: 1, region: 1 })
      .lean(),
  ]);

  if (rawFailed > 0) {
    await upsertActiveAlert({
      title: "Scraping failures detected",
      message: `There are ${rawFailed} raw snapshots marked failed. Review parser/source issues.`,
      level: "warning",
      createdAt: now,
    });
  }

  // Basic sanity: negative prices should never exist in normalized records.
  const negativePrices = await NormalizedFuelRecord.countDocuments({
    pricePerLiter: { $lt: 0 },
  });

  if (negativePrices > 0) {
    await upsertActiveAlert({
      title: "Invalid negative prices detected",
      message: `Found ${negativePrices} records with negative prices. These should be rejected upstream.`,
      level: "critical",
      createdAt: now,
    });
  }

  if (recentOfficialCoverage < FuelTypeValues.length) {
    await upsertActiveAlert({
      title: "Official coverage is incomplete",
      message: `Only ${recentOfficialCoverage} recent headline official price records were found in the last 7 days. Review the official DOE collection pipeline.`,
      level: "warning",
      createdAt: now,
    });
  }

  if (
    !latestOfficialHeadline ||
    !latestOfficialHeadline.lastVerifiedAt ||
    isStale("official_local", new Date(latestOfficialHeadline.lastVerifiedAt), now)
  ) {
    await upsertActiveAlert({
      title: "Official headline prices are stale",
      message: "No recent official headline price has been verified within the expected weekly freshness window.",
      level: "critical",
      createdAt: now,
    });
  }

  await UpdateLog.create({
    module: "data_quality",
    status: "success",
    message: `Quality monitor ran. normalizedCount=${normalizedCount} rawFailed=${rawFailed} recentOfficialCoverage=${recentOfficialCoverage}`,
    timestamp: now,
  });
}
