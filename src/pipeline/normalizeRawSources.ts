import { RawScrapedSource } from "../models/RawScrapedSource";
import { NormalizedFuelRecord } from "../models/NormalizedFuelRecord";
import { parsers } from "../parsers";
import { buildFingerprint } from "../normalization/fingerprint";
import { UpdateLog } from "../models/UpdateLog";
import { validateCandidate } from "../normalization/validators";
import { fetchStatic } from "../utils/http";

export async function normalizePendingRawSources(params?: { limit?: number }) {
  const limit = params?.limit ?? 50;
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Only process raw sources from last 24h by default

  const pending = await RawScrapedSource.find({
    $or: [
      // Normal flow: only untouched raw placeholders from the last 24h.
      { processingStatus: "raw", scrapedAt: { $gte: from } },

      // Retry fail-closed errors that are known to be parser/regex related.
      {
        processingStatus: "failed",
        parserId: "doe_pdf_v1",
        scrapedAt: { $gte: from },
        errorMessage: {
          $regex: "(expected fuel patterns|no fuel prices/deltas extracted)",
          $options: "i",
        },
      },
    ],
  })
    .sort({ scrapedAt: -1 })
    .limit(limit);

  let normalized = 0;
  let failed = 0;

  for (const raw of pending) {
    // Many RawScrapedSource rows are created as placeholders (discovered URLs).
    // Fetch content here if missing so parsing can proceed.
    // Skip PDF sources: they are handled by extractPdfText inside the doePdfParser itself.
    if (!raw.rawHtml && !raw.rawText && raw.parserId !== "doe_pdf_v1") {
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

