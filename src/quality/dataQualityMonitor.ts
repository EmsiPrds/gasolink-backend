import { Alert } from "../models/Alert";
import { NormalizedFuelRecord } from "../models/NormalizedFuelRecord";
import { RawScrapedSource } from "../models/RawScrapedSource";
import { UpdateLog } from "../models/UpdateLog";

export async function runDataQualityMonitor() {
  const now = new Date();

  const [rawFailed, normalizedCount] = await Promise.all([
    RawScrapedSource.countDocuments({ processingStatus: "failed" }),
    NormalizedFuelRecord.countDocuments({}),
  ]);

  if (rawFailed > 0) {
    await Alert.create({
      title: "Scraping failures detected",
      message: `There are ${rawFailed} raw snapshots marked failed. Review parser/source issues.`,
      level: "warning",
      active: true,
      createdAt: now,
    });
  }

  // Basic sanity: negative prices should never exist in normalized records.
  const negativePrices = await NormalizedFuelRecord.countDocuments({
    pricePerLiter: { $lt: 0 },
  });

  if (negativePrices > 0) {
    await Alert.create({
      title: "Invalid negative prices detected",
      message: `Found ${negativePrices} records with negative prices. These should be rejected upstream.`,
      level: "critical",
      active: true,
      createdAt: now,
    });
  }

  await UpdateLog.create({
    module: "data_quality",
    status: "success",
    message: `Quality monitor ran. normalizedCount=${normalizedCount} rawFailed=${rawFailed}`,
    timestamp: now,
  });
}

