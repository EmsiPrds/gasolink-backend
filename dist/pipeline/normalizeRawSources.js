"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePendingRawSources = normalizePendingRawSources;
exports.drainPendingRawSources = drainPendingRawSources;
const RawScrapedSource_1 = require("../models/RawScrapedSource");
const NormalizedFuelRecord_1 = require("../models/NormalizedFuelRecord");
const parsers_1 = require("../parsers");
const fingerprint_1 = require("../normalization/fingerprint");
const UpdateLog_1 = require("../models/UpdateLog");
const validators_1 = require("../normalization/validators");
const http_1 = require("../utils/http");
const constants_1 = require("../parsers/doe/constants");
const doeLatestPolicy_1 = require("../utils/doeLatestPolicy");
const MAX_DOE_DOC_AGE_DAYS = 14;
async function normalizePendingRawSources(params) {
    const limit = params?.limit ?? 50;
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Only process raw sources from last 24h by default
    const freshnessCutoff = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000); // current or previous weekly DOE bulletin
    const pending = await RawScrapedSource_1.RawScrapedSource.find({
        $or: [
            // Normal flow: only untouched raw placeholders from the last 24h.
            { processingStatus: "raw", scrapedAt: { $gte: from } },
            // Retry fail-closed errors that are known to be parser/regex related.
            {
                processingStatus: "failed",
                parserId: { $in: ["doe_pdf_v1", constants_1.DOE_PDF_PARSER_ID] },
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
    const staged = [];
    const activeRawDoe = await RawScrapedSource_1.RawScrapedSource.findOne({
        sourceType: "official_local",
        aiSelectedLatest: true,
        aiDocumentDate: { $gte: freshnessCutoff, $lte: now },
    })
        .sort({ aiDocumentDate: -1, scrapedAt: -1 })
        .select({ sourceUrl: 1 })
        .lean();
    const activeDoeUrl = activeRawDoe?.sourceUrl ? (0, doeLatestPolicy_1.normalizeSourceUrl)(String(activeRawDoe.sourceUrl)) : null;
    for (const raw of pending) {
        // Many RawScrapedSource rows are created as placeholders (discovered URLs).
        // Fetch content here if missing so parsing can proceed.
        // Skip PDF sources: they are handled by extractPdfText inside the doePdfParser itself.
        if (!raw.rawHtml && !raw.rawText && raw.parserId !== "doe_pdf_v1" && raw.parserId !== constants_1.DOE_PDF_PARSER_ID) {
            try {
                const fetched = await (0, http_1.fetchStatic)(raw.sourceUrl);
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
            if (validated.sourceType === "official_local") {
                const strictDocDate = (0, doeLatestPolicy_1.resolveDoeDocumentDate)(validated.sourceUrl, validated.effectiveAt ?? validated.sourcePublishedAt);
                if (!strictDocDate)
                    continue;
            }
            staged.push({ raw, validated });
        }
    }
    for (const entry of staged) {
        const { raw, validated } = entry;
        if (validated.sourceType === "official_local") {
            const docDate = (0, doeLatestPolicy_1.resolveDoeDocumentDate)(validated.sourceUrl, validated.effectiveAt ?? validated.sourcePublishedAt);
            if (!docDate || docDate < freshnessCutoff)
                continue;
            if (!activeDoeUrl)
                continue;
            if ((0, doeLatestPolicy_1.normalizeSourceUrl)(validated.sourceUrl) !== activeDoeUrl)
                continue;
        }
        const fingerprint = (0, fingerprint_1.buildFingerprint)({
            sourceType: validated.sourceType,
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
                sourceCategory: validated.sourceType === "official_local" ? "doe_official" : "web_scrape",
                fingerprint,
                rawSourceId: raw._id,
            },
        }, { upsert: true });
        normalized += 1;
    }
    for (const raw of pending) {
        if (raw.processingStatus === "raw") {
            raw.processingStatus = "normalized";
            await raw.save();
        }
    }
    await UpdateLog_1.UpdateLog.create({
        module: "normalize",
        status: failed > 0 ? "failure" : "success",
        message: `Normalization processed=${pending.length} normalized=${normalized} failed=${failed}`,
        timestamp: new Date(),
    });
    return { processed: pending.length, normalized, failed };
}
async function drainPendingRawSources(params) {
    const limitPerPass = params?.limitPerPass ?? 100;
    const maxPasses = params?.maxPasses ?? 5;
    let passes = 0;
    let processed = 0;
    let normalized = 0;
    let failed = 0;
    while (passes < maxPasses) {
        const result = await normalizePendingRawSources({ limit: limitPerPass });
        passes += 1;
        processed += result.processed;
        normalized += result.normalized;
        failed += result.failed;
        if (result.processed === 0)
            break;
    }
    return { passes, processed, normalized, failed };
}
