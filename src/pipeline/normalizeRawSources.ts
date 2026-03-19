import { RawScrapedSource } from "../models/RawScrapedSource";
import { NormalizedFuelRecord } from "../models/NormalizedFuelRecord";
import { parsers } from "../parsers";
import { buildFingerprint } from "../normalization/fingerprint";
import { UpdateLog } from "../models/UpdateLog";
import { validateCandidate } from "../normalization/validators";
import { fetchStatic } from "../scrapers/httpFetch";

export async function normalizePendingRawSources(params?: { limit?: number }) {
  const limit = params?.limit ?? 50;
  const pending = await RawScrapedSource.find({ processingStatus: "raw" }).sort({ scrapedAt: -1 }).limit(limit);

  let normalized = 0;
  let failed = 0;

  for (const raw of pending) {
    // Many RawScrapedSource rows are created as placeholders (discovered URLs).
    // Fetch content here if missing so parsing can proceed.
    if (!raw.rawHtml && !raw.rawText) {
      try {
        const fetched = await fetchStatic(raw.sourceUrl);
        if (fetched.status >= 200 && fetched.status < 300) {
          raw.rawHtml = fetched.html;
          raw.rawText = fetched.text;
        } else {
          raw.processingStatus = "failed";
          raw.errorMessage = `HTTP ${fetched.status}`;
          await raw.save();
          failed += 1;
          continue;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        raw.processingStatus = "failed";
        raw.errorMessage = msg;
        await raw.save();
        failed += 1;
        continue;
      }
    }

    const parser = parsers.find((p) => p.canHandle(raw as any));
    if (!parser) {
      raw.processingStatus = "failed";
      raw.errorMessage = "No parser matched";
      await raw.save();
      failed += 1;
      continue;
    }

    const res = await parser.parse(raw as any);
    if (!res.ok) {
      raw.processingStatus = "failed";
      raw.errorMessage = res.error;
      await raw.save();
      failed += 1;
      continue;
    }

    // For parsers that only expand links (e.g., DOE listings), just mark normalized.
    if (res.items.length === 0) {
      raw.processingStatus = "normalized";
      await raw.save();
      continue;
    }

    for (const item of res.items) {
      const validated = validateCandidate(item);
      const fingerprint = buildFingerprint({
        sourceUrl: validated.sourceUrl,
        sourcePublishedAt: validated.sourcePublishedAt ? validated.sourcePublishedAt.toISOString() : "",
        fuelType: validated.fuelType,
        region: validated.region,
        city: validated.city ?? "",
        pricePerLiter: validated.pricePerLiter ?? "",
        priceChange: validated.priceChange ?? "",
        effectiveAt: validated.effectiveAt ? validated.effectiveAt.toISOString() : "",
      });

      await NormalizedFuelRecord.updateOne(
        { fingerprint },
        {
          $setOnInsert: {
            ...validated,
            fingerprint,
            rawSourceId: raw._id,
            updatedAt: validated.scrapedAt,
          },
        },
        { upsert: true },
      );
      normalized += 1;
    }

    raw.processingStatus = "normalized";
    await raw.save();
  }

  await UpdateLog.create({
    module: "normalize",
    status: failed > 0 ? "failure" : "success",
    message: `Normalization processed=${pending.length} normalized=${normalized} failed=${failed}`,
    timestamp: new Date(),
  });

  return { processed: pending.length, normalized, failed };
}

