import { z } from "zod";
import { env } from "../config/env";

const DoeValidationSchema = z.object({
  latestDocUrl: z.string().url(),
  documentDate: z.string().min(1), // ISO date or ISO datetime (validated later)
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
});

export type DoeAiValidation = z.infer<typeof DoeValidationSchema>;

const MAX_DOE_DOC_AGE_DAYS = 14; // allow current or previous weekly bulletin

function isWithinAllowedWindow(date: Date, now: Date): boolean {
  const from = new Date(now.getTime() - MAX_DOE_DOC_AGE_DAYS * 24 * 60 * 60 * 1000);
  return date >= from && date <= now;
}

function parseIsoDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function buildFailClosedResult(
  now: Date,
  candidates: Array<{ url: string; label?: string; publishedAtHint?: string | null }>,
  reason: string,
): DoeAiValidation {
  const fallbackUrl =
    candidates.find((c) => typeof c.url === "string" && c.url.startsWith("http"))?.url ?? "https://prod-cms.doe.gov.ph";
  return {
    latestDocUrl: fallbackUrl,
    documentDate: now.toISOString(),
    confidence: 0,
    reason,
  };
}

async function callOpenAiJson(prompt: string): Promise<any> {
  if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY.includes("replace_me")) {
    throw new Error("OpenAI API key not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a strict DOE document freshness validator. Output ONLY valid JSON. If uncertain, output low confidence and explain why.",
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

  const json = (await response.json()) as any;
  const content = json?.choices?.[0]?.message?.content as string | undefined;
  if (!content) throw new Error("OpenAI returned empty content.");
  return JSON.parse(content);
}

export async function validateLatestDoeDocWithAi(params: {
  now: Date;
  listingUrl: string;
  listingHtmlSnippet?: string;
  candidates: Array<{ url: string; label?: string; publishedAtHint?: string | null }>;
  pdfTextSnippet?: string;
}): Promise<DoeAiValidation> {
  const candidateLines = params.candidates
    .slice(0, 30)
    .map(
      (c) =>
        `- url: ${c.url}\n  label: ${c.label ?? ""}\n  publishedAtHint: ${c.publishedAtHint ?? ""}`.trim(),
    )
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

  let parsed: DoeAiValidation;
  try {
    const raw = await callOpenAiJson(prompt);
    const objectSchema = z.object({
      latestDocUrl: z.string().optional(),
      documentDate: z.union([z.string(), z.null()]).optional(),
      confidence: z.number().optional(),
      reason: z.string().optional(),
    });
    const loose = objectSchema.parse(raw);
    parsed = DoeValidationSchema.parse({
      latestDocUrl: loose.latestDocUrl ?? params.candidates[0]?.url ?? "https://prod-cms.doe.gov.ph",
      documentDate: loose.documentDate ?? "",
      confidence: typeof loose.confidence === "number" ? loose.confidence : 0,
      reason: loose.reason ?? "OpenAI could not confidently validate DOE document freshness.",
    });
  } catch (error) {
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
