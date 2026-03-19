"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePendingRawSources = normalizePendingRawSources;
const RawScrapedSource_1 = require("../models/RawScrapedSource");
const NormalizedFuelRecord_1 = require("../models/NormalizedFuelRecord");
const parsers_1 = require("../parsers");
const fingerprint_1 = require("../normalization/fingerprint");
const UpdateLog_1 = require("../models/UpdateLog");
const validators_1 = require("../normalization/validators");
const httpFetch_1 = require("../scrapers/httpFetch");
async function normalizePendingRawSources(params) {
    const limit = params?.limit ?? 50;
    const pending = await RawScrapedSource_1.RawScrapedSource.find({
        $or: [
            // Normal flow: only untouched raw placeholders.
            { processingStatus: "raw" },
            // Retry fail-closed errors that are known to be parser/regex related.
            // This prevents "Raw failed" from staying stuck after we improve parsing logic.
            {
                processingStatus: "failed",
                parserId: "doe_pdf_v1",
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
        if (!raw.rawHtml && !raw.rawText) {
            try {
                const fetched = await (0, httpFetch_1.fetchStatic)(raw.sourceUrl);
                if (fetched.status >= 200 && fetched.status < 300) {
                    raw.rawHtml = fetched.html;
                    raw.rawText = fetched.text;
                }
                else {
                    raw.processingStatus = "failed";
                    raw.errorMessage = `HTTP ${fetched.status}`;
                    await raw.save();
                    failed += 1;
                    continue;
                }
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                raw.processingStatus = "failed";
                raw.errorMessage = msg;
                await raw.save();
                failed += 1;
                continue;
            }
        }
        const parser = parsers_1.parsers.find((p) => p.canHandle(raw));
        if (!parser) {
            raw.processingStatus = "failed";
            raw.errorMessage = "No parser matched";
            await raw.save();
            failed += 1;
            continue;
        }
        const res = await parser.parse(raw);
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
            const validated = (0, validators_1.validateCandidate)(item);
            const fingerprint = (0, fingerprint_1.buildFingerprint)({
                sourceUrl: validated.sourceUrl,
                sourcePublishedAt: validated.sourcePublishedAt ? validated.sourcePublishedAt.toISOString() : "",
                fuelType: validated.fuelType,
                region: validated.region,
                city: validated.city ?? "",
                pricePerLiter: validated.pricePerLiter ?? "",
                priceChange: validated.priceChange ?? "",
                effectiveAt: validated.effectiveAt ? validated.effectiveAt.toISOString() : "",
            });
            await NormalizedFuelRecord_1.NormalizedFuelRecord.updateOne({ fingerprint }, {
                $setOnInsert: {
                    ...validated,
                    fingerprint,
                    rawSourceId: raw._id,
                    updatedAt: validated.scrapedAt,
                },
            }, { upsert: true });
            normalized += 1;
        }
        raw.processingStatus = "normalized";
        await raw.save();
    }
    await UpdateLog_1.UpdateLog.create({
        module: "normalize",
        status: failed > 0 ? "failure" : "success",
        message: `Normalization processed=${pending.length} normalized=${normalized} failed=${failed}`,
        timestamp: new Date(),
    });
    return { processed: pending.length, normalized, failed };
}
