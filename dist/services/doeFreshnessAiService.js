"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLatestDoeDocWithAi = validateLatestDoeDocWithAi;
const zod_1 = require("zod");
const env_1 = require("../config/env");
const DoeValidationSchema = zod_1.z.object({
    latestDocUrl: zod_1.z.string().url(),
    documentDate: zod_1.z.string().min(1), // ISO date or ISO datetime (validated later)
    confidence: zod_1.z.number().min(0).max(1),
    reason: zod_1.z.string().min(1),
});
const MAX_DOE_DOC_AGE_DAYS = 14; // allow current or previous weekly bulletin
function isWithinAllowedWindow(date, now) {
    const from = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000);
    return date >= from && date <= now;
}
function parseIsoDate(value) {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
}
function buildFailClosedResult(now, candidates, reason) {
    const fallbackUrl = candidates.find((c) => typeof c.url === "string" && c.url.startsWith("http"))?.url ?? "https://prod-cms.doe.gov.ph";
    return {
        latestDocUrl: fallbackUrl,
        documentDate: now.toISOString(),
        confidence: 0,
        reason,
    };
}
async function callOpenAiJson(prompt) {
    if (!env_1.env.OPENAI_API_KEY || env_1.env.OPENAI_API_KEY.includes("replace_me")) {
        throw new Error("OpenAI API key not configured.");
    }
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env_1.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: env_1.env.OPENAI_MODEL,
            messages: [
                {
                    role: "system",
                    content: "You are a strict DOE document freshness validator. Output ONLY valid JSON. If uncertain, output low confidence and explain why.",
                },
                { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI error ${response.status}: ${errorText}`);
    }
    const json = (await response.json());
    const content = json?.choices?.[0]?.message?.content;
    if (!content)
        throw new Error("OpenAI returned empty content.");
    return JSON.parse(content);
}
async function validateLatestDoeDocWithAi(params) {
    const candidateLines = params.candidates
        .slice(0, 30)
        .map((c) => `- url: ${c.url}\n  label: ${c.label ?? ""}\n  publishedAtHint: ${c.publishedAtHint ?? ""}`.trim())
        .join("\n");
    const prompt = `
Today: ${params.now.toISOString()}
DOE listing: ${params.listingUrl}

Task:
1) Choose the SINGLE newest/most recent DOE pump price PDF document from the candidates.
2) Extract/verify the document's real publication/effective date from the candidate label/URL hints and (if provided) PDF text snippet.

Hard rules:
- Output must be JSON with keys: latestDocUrl, documentDate, confidence (0-1), reason.
- confidence must be LOW (<=0.4) if date cannot be confidently determined.
- Reject outdated: documentDate must be within the last ${MAX_DOE_DOC_AGE_DAYS} days from Today. If not, still output JSON but set low confidence and explain.

Candidates:
${candidateLines}

Listing HTML snippet (may help find latest wording):
${(params.listingHtmlSnippet ?? "").slice(0, 6000)}

PDF text snippet (may include \"As of\" or \"For the week of\"):
${(params.pdfTextSnippet ?? "").slice(0, 8000)}

Return ONLY JSON:
{
  \"latestDocUrl\": \"https://...\",\n  \"documentDate\": \"YYYY-MM-DD\" or ISO datetime,\n  \"confidence\": 0.0,\n  \"reason\": \"...\"\n}
`;
    let parsed;
    try {
        const raw = await callOpenAiJson(prompt);
        const objectSchema = zod_1.z.object({
            latestDocUrl: zod_1.z.string().optional(),
            documentDate: zod_1.z.union([zod_1.z.string(), zod_1.z.null()]).optional(),
            confidence: zod_1.z.number().optional(),
            reason: zod_1.z.string().optional(),
        });
        const loose = objectSchema.parse(raw);
        parsed = DoeValidationSchema.parse({
            latestDocUrl: loose.latestDocUrl ?? params.candidates[0]?.url ?? "https://prod-cms.doe.gov.ph",
            documentDate: loose.documentDate ?? "",
            confidence: typeof loose.confidence === "number" ? loose.confidence : 0,
            reason: loose.reason ?? "OpenAI could not confidently validate DOE document freshness.",
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return buildFailClosedResult(params.now, params.candidates, `OpenAI DOE validator failed: ${message}`);
    }
    const docDate = parseIsoDate(parsed.documentDate);
    if (!docDate) {
        return { ...parsed, confidence: Math.min(parsed.confidence, 0.3), reason: `${parsed.reason} (Invalid or missing date)` };
    }
    if (!isWithinAllowedWindow(docDate, params.now)) {
        return {
            ...parsed,
            confidence: Math.min(parsed.confidence, 0.25),
            reason: `${parsed.reason} (Document date not within ${MAX_DOE_DOC_AGE_DAYS} days)`,
        };
    }
    return parsed;
}
