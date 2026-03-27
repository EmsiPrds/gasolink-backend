"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFuelDataWithAi = extractFuelDataWithAi;
exports.validateUserReportWithAi = validateUserReportWithAi;
exports.searchAndExtractFuelPricesWithAi = searchAndExtractFuelPricesWithAi;
exports.refinePriceWithAi = refinePriceWithAi;
exports.discoverLatestLinksWithAi = discoverLatestLinksWithAi;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const env_1 = require("../config/env");
const searchService_1 = require("./searchService");
let groqInstance = null;
function getGroqClient() {
    if (groqInstance)
        return groqInstance;
    if (!env_1.env.GROQ_API_KEY || env_1.env.GROQ_API_KEY.includes("replace_me")) {
        throw new Error("Groq API key not configured.");
    }
    groqInstance = new groq_sdk_1.default({ apiKey: env_1.env.GROQ_API_KEY });
    return groqInstance;
}
async function callOpenRouter(params, retries = 2) {
    if (!env_1.env.OPENROUTER_API_KEY || env_1.env.OPENROUTER_API_KEY.includes("replace_me")) {
        throw new Error("OpenRouter API key not configured.");
    }
    const requestData = {
        model: env_1.env.OPENROUTER_MODEL,
        messages: params.messages,
        max_tokens: 2048, // Limit output to avoid "Payment Required" for high context models
    };
    if (params.response_format && Object.keys(params.response_format).length > 0) {
        requestData.response_format = params.response_format;
    }
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${env_1.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://gasolink.local",
                    "X-Title": "Gasolink",
                },
                body: JSON.stringify(requestData),
            });
            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 429 && i < retries - 1) {
                    console.warn(`OpenRouter rate limited (429). Attempt ${i + 1}/${retries}. Retrying in 3s...`);
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                    continue;
                }
                console.error(`OpenRouter API Error: ${response.status} ${response.statusText}`);
                console.error("Error Body:", errorText);
                throw new Error(`OpenRouter Error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            if (i < retries - 1) {
                console.warn(`OpenRouter fetch exception: ${error.message}. Attempt ${i + 1}/${retries}. Retrying...`);
                await new Promise((resolve) => setTimeout(resolve, 2000));
                continue;
            }
            console.error("OpenRouter Fetch Exception:", error.message);
            throw error;
        }
    }
}
async function callOpenAI(params, retries = 2) {
    if (!env_1.env.OPENAI_API_KEY || env_1.env.OPENAI_API_KEY.includes("replace_me")) {
        throw new Error("OpenAI API key not configured.");
    }
    const requestData = {
        model: env_1.env.OPENAI_MODEL,
        messages: params.messages,
        response_format: { type: "json_object" }, // Enforce JSON mode
    };
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${env_1.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestData),
            });
            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 429 && i < retries - 1) {
                    console.warn(`OpenAI rate limited (429). Attempt ${i + 1}/${retries}. Retrying in 5s...`);
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                    continue;
                }
                console.error(`OpenAI API Error: ${response.status} ${response.statusText}`);
                console.error("Error Body:", errorText);
                throw new Error(`OpenAI Error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            if (i < retries - 1) {
                console.warn(`OpenAI fetch exception: ${error.message}. Attempt ${i + 1}/${retries}. Retrying...`);
                await new Promise((resolve) => setTimeout(resolve, 3000));
                continue;
            }
            console.error("OpenAI Fetch Exception:", error.message);
            throw error;
        }
    }
}
async function callAiProvider(params) {
    const hasOpenRouter = env_1.env.OPENROUTER_API_KEY && !env_1.env.OPENROUTER_API_KEY.includes("replace_me");
    const hasGroq = env_1.env.GROQ_API_KEY && !env_1.env.GROQ_API_KEY.includes("replace_me");
    const hasOpenAI = env_1.env.OPENAI_API_KEY && !env_1.env.OPENAI_API_KEY.includes("replace_me");
    if (env_1.env.AI_PROVIDER === "openai" && hasOpenAI) {
        try {
            return await callOpenAI(params);
        }
        catch (error) {
            if (hasGroq) {
                console.warn("OpenAI failed, falling back to Groq...", error);
                return await callGroqWithFallback(params);
            }
            throw error;
        }
    }
    if (env_1.env.AI_PROVIDER === "openrouter" && hasOpenRouter) {
        try {
            return await callOpenRouter(params);
        }
        catch (error) {
            if (hasGroq) {
                console.warn("OpenRouter failed, falling back to Groq...", error);
                return await callGroqWithFallback(params);
            }
            throw error;
        }
    }
    // Default to Groq
    if (hasGroq) {
        return await callGroqWithFallback(params);
    }
    // If we reach here, neither provider is properly configured
    if (env_1.env.AI_PROVIDER === "openrouter") {
        throw new Error("AI_PROVIDER is 'openrouter' but OPENROUTER_API_KEY is missing.");
    }
    else {
        throw new Error("AI_PROVIDER is 'groq' but GROQ_API_KEY is missing.");
    }
}
async function extractFuelDataWithAi(text) {
    const prompt = `
Extract fuel price adjustment data from the following text. 
Identify price changes (increase/decrease) or actual pump prices per liter in Philippine Pesos (PHP).

CRITICAL: If the text contains multiple dates or adjustments, ONLY extract the MOST RECENT one. 
Look for phrases like "effective as of", "starting", "effective date", or the latest date mentioned in the context of price changes.

The text may be from the Department of Energy (DOE), oil companies (Petron, Shell, etc.), or news outlets.

Return ONLY a JSON object with this structure:
{
  "items": [
    {
      "fuelType": "Gasoline" | "Diesel" | "Kerosene",
      "pricePerLiter": number | null,
      "priceChange": number | null,
      "effectiveAt": "YYYY-MM-DD" | null,
      "region": "NCR" | "Luzon" | "Visayas" | "Mindanao" | null,
      "city": string | null,
      "companyName": string | null,
      "productName": string | null,
      "sourceName": string,
      "sourceUrl": string
    }
  ],
  "confidence": number (0-1),
  "reasoning": "brief explanation of extraction logic"
}

Text to analyze:
${text.substring(0, 12000)}
`;
    try {
        const response = await callAiProvider({
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
        });
        const content = response.choices[0]?.message?.content;
        if (!content)
            return null;
        const result = JSON.parse(content);
        return result;
    }
    catch (error) {
        console.error("Error in extractFuelDataWithAi:", error);
        return null;
    }
}
async function validateUserReportWithAi(report, context) {
    const prompt = `
You are an AI data validator for GASOLINK, a fuel price monitoring system in the Philippines.
A user has reported a fuel price. Validate if this report is "sane" and "reliable" based on the provided context.

User Report:
- Fuel Type: ${report.fuelType}
- Price: ₱${report.price}
- Location: ${report.location}

Context:
- Current Regional Average: ₱${context.regionalAverage}
- Last Official Price: ₱${context.lastOfficialPrice}

Rules:
1. Prices in the Philippines are usually between ₱40 and ₱95.
2. If the reported price deviates by more than 15% from the regional average or official price, it might be an outlier or error.
3. Consider if the price is realistic for the current market (March 2026).

Return ONLY a JSON object:
{
  "isValid": boolean,
  "confidence": number (0-1),
  "reasoning": "brief explanation"
}
`;
    try {
        const response = await callAiProvider({
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
        });
        const content = response.choices[0]?.message?.content;
        if (!content)
            return { isValid: false, confidence: 0, reasoning: "AI failed to respond" };
        return JSON.parse(content);
    }
    catch (error) {
        console.error("Error in validateUserReportWithAi:", error);
        return { isValid: false, confidence: 0, reasoning: "Validation error" };
    }
}
async function callGroqWithFallback(params, retries = 2) {
    let lastError;
    const models = [env_1.env.GROQ_MODEL, env_1.env.GROQ_FALLBACK_MODEL];
    for (const model of models) {
        for (let i = 0; i < retries; i++) {
            try {
                const groq = getGroqClient();
                return await groq.chat.completions.create({
                    ...params,
                    model,
                });
            }
            catch (error) {
                lastError = error;
                if (error.status === 429) {
                    console.warn(`Rate limit on model ${model}. Attempt ${i + 1}/${retries}. Waiting...`);
                    // Wait if retry-after is provided, otherwise 2s
                    const waitMs = (error.headers?.get?.("retry-after") ? parseInt(error.headers.get("retry-after")) * 1000 : 2000) + 500;
                    await new Promise((resolve) => setTimeout(resolve, waitMs));
                    continue;
                }
                throw error;
            }
        }
        console.warn(`Model ${model} exhausted. Trying next model...`);
    }
    throw lastError;
}
function extractHost(url) {
    try {
        return new URL(url).hostname.toLowerCase();
    }
    catch {
        return "";
    }
}
function classifyCredibility(host) {
    const authoritativeHosts = [
        "doe.gov.ph",
        "petron.com",
        "petron.com.ph",
        "shell.com.ph",
        "caltex.com",
        "chevron.com",
        "seaoil.com.ph",
        "unioil.com",
        "phoenixfuels.ph",
        "cleanfuel.ph",
    ];
    const verifiedReportHosts = [
        "gmanetwork.com",
        "abs-cbn.com",
        "inquirer.net",
        "philstar.com",
        "rappler.com",
        "mb.com.ph",
        "business.inquirer.net",
    ];
    if (authoritativeHosts.some((h) => host === h || host.endsWith(`.${h}`)))
        return "authoritative";
    if (verifiedReportHosts.some((h) => host === h || host.endsWith(`.${h}`)))
        return "verified_report";
    return "unknown";
}
function scoreSearchResult(result) {
    const host = extractHost(result.link);
    const credibility = classifyCredibility(host);
    const titleSnippet = `${result.title} ${result.snippet}`.toLowerCase();
    const recencySignal = /\b(today|yesterday|latest|this week|effective|adjustment)\b/.test(titleSnippet) ? 0.08 : 0;
    const fuelSignal = /\b(gasoline|diesel|kerosene|fuel|oil)\b/.test(titleSnippet) ? 0.07 : 0;
    const authorityBase = credibility === "authoritative" ? 0.8 : credibility === "verified_report" ? 0.6 : 0.25;
    return {
        ...result,
        host,
        credibility,
        authorityScore: Math.min(1, authorityBase + recencySignal + fuelSignal),
    };
}
function dedupeAndRankSearchResults(results) {
    const byUrl = new Map();
    for (const result of results) {
        const ranked = scoreSearchResult(result);
        const existing = byUrl.get(ranked.link);
        if (!existing || ranked.authorityScore > existing.authorityScore) {
            byUrl.set(ranked.link, ranked);
        }
    }
    return Array.from(byUrl.values()).sort((a, b) => b.authorityScore - a.authorityScore);
}
function parseIsoDate(value) {
    if (!value)
        return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function isWithinDays(date, days) {
    const now = Date.now();
    const diffMs = now - date.getTime();
    return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
}
function isAdjustmentRelevant(text) {
    const normalized = text.toLowerCase();
    const hasFuel = /\b(gasoline|diesel|kerosene|fuel|oil)\b/.test(normalized);
    const hasAdjustmentSignal = /\b(price adjustment|pump price|rollback|increase|decrease|hike|effective)\b/.test(normalized);
    const hasLikelyNoise = /\b(typhoon|bayanihan|response|relief|donation|csr|price freeze|freeze)\b/.test(normalized);
    return hasFuel && hasAdjustmentSignal && !hasLikelyNoise;
}
function filterRecentRelevantResults(ranked) {
    return ranked.filter((r) => {
        const text = `${r.title} ${r.snippet} ${r.link}`;
        const lowerUrl = r.link.toLowerCase();
        // Exclude known non-market advisories that can look fuel-related but are not regular pump-price updates.
        if (/(typhoon|price-freeze|price%20freeze|bayanihan)/.test(lowerUrl))
            return false;
        const yearMatch = text.match(/\b(20\d{2})\b/);
        if (yearMatch) {
            const y = Number(yearMatch[1]);
            const currentYear = new Date().getFullYear();
            if (Number.isFinite(y) && y < currentYear)
                return false;
        }
        if (!isAdjustmentRelevant(text))
            return false;
        // If Serper provides a date, enforce freshness strictly.
        const dated = parseIsoDate(r.date);
        if (dated)
            return isWithinDays(dated, 21);
        // If date is missing, keep only stronger sources.
        return r.credibility !== "unknown" && r.authorityScore >= 0.6;
    });
}
function sanitizeExtraction(result, ranked) {
    const rankedByUrl = new Map(ranked.map((r) => [r.link, r]));
    const dedupe = new Set();
    const cleanedItems = result.items
        .map((item) => {
        const source = rankedByUrl.get(item.sourceUrl);
        const credibility = source?.credibility ?? "unknown";
        const reliabilityScore = source ? Math.min(1, source.authorityScore * (result.confidence || 0.3)) : 0.2;
        return {
            ...item,
            credibility,
            reliabilityScore,
            contextSummary: [
                item.fuelType,
                item.region ?? "UnknownRegion",
                item.effectiveAt ?? "UnknownDate",
                item.pricePerLiter != null ? `price=${item.pricePerLiter}` : item.priceChange != null ? `delta=${item.priceChange}` : "",
            ]
                .filter(Boolean)
                .join(" | "),
        };
    })
        .filter((item) => {
        if (item.pricePerLiter == null && item.priceChange == null)
            return false;
        if (!item.effectiveAt)
            return false;
        const effectiveAt = parseIsoDate(item.effectiveAt);
        if (!effectiveAt || !isWithinDays(effectiveAt, 21))
            return false;
        if (!item.region)
            return false;
        return true;
    })
        .filter((item) => {
        const key = `${item.sourceUrl}::${item.fuelType}::${item.region}::${item.effectiveAt}`;
        if (dedupe.has(key))
            return false;
        dedupe.add(key);
        return true;
    });
    return {
        ...result,
        items: cleanedItems,
        confidence: Math.max(result.confidence ?? 0, cleanedItems.length > 0 ? 0.35 : 0),
    };
}
async function searchAndExtractFuelPricesWithAi() {
    const today = new Date().toISOString().split("T")[0];
    const strictQueries = [
        `site:doe.gov.ph "fuel price" adjustment ${today}`,
        `site:petron.com "price adjustment" ${today}`,
        `site:shell.com.ph "price adjustment" ${today}`,
    ];
    const broadQueries = [
        "Philippines fuel price increase decrease latest official",
        "oil price adjustment Philippines this week",
        "DOE Philippines fuel price advisory latest",
        "Philippines fuel price advisory Tuesday",
        "DOE retail pump prices Philippines",
        "Petron Shell Caltex fuel price advisory Philippines",
        `site:doe.gov.ph "price adjustment" Philippines`,
        `site:inquirer.net OR site:gmanetwork.com OR site:rappler.com "fuel price adjustment" Philippines`,
    ];
    const allSearchResults = [];
    for (const query of strictQueries) {
        const results = await (0, searchService_1.searchWeb)(query);
        allSearchResults.push(...results);
    }
    // If strict date-targeted searches found little/no data, widen the net.
    if (allSearchResults.length < 5) {
        for (const query of broadQueries) {
            const results = await (0, searchService_1.searchWeb)(query);
            allSearchResults.push(...results);
        }
    }
    if (allSearchResults.length === 0) {
        return null;
    }
    // Prioritize authoritative/verified, then require recency/relevance.
    const uniqueResults = filterRecentRelevantResults(dedupeAndRankSearchResults(allSearchResults)).slice(0, 12);
    if (uniqueResults.length === 0)
        return null;
    const context = uniqueResults
        .map((r) => `Source: ${r.title}\nURL: ${r.link}\nHost: ${r.host}\nCredibility: ${r.credibility}\nAuthorityScore: ${r.authorityScore.toFixed(2)}\nSnippet: ${r.snippet}\nDate: ${r.date ?? "N/A"}`)
        .join("\n\n");
    const prompt = `
Today's Date: ${today}

You are a Philippine fuel price intelligence agent. Extract the LATEST fuel price adjustments (effective this week or next) from the search results.

CRITICAL: 
1. Prefer data that is LATEST and RELEVANT to the current week, but if none exists, use the most recent credible advisory found.
2. Fuel price changes in the Philippines are usually announced on Mondays and effective on Tuesdays.
3. If multiple adjustments are found, prioritize items with the latest effective date window.
4. Reject low-credibility claims unless corroborated by authoritative/verified sources.
5. Remove duplicates: same fuelType + region + effectiveAt + sourceUrl should appear only once.

SOURCES TO TRUST (In order of priority):
1. Department of Energy (DOE) - doe.gov.ph (OFFICIAL)
2. Major Oil Companies: Petron, Shell, Caltex, Seaoil, Unioil, Phoenix, Cleanfuel.
3. Reputable News: GMA News, ABS-CBN, Inquirer, Philstar, Rappler.

EXTRACTION RULES:
- effectiveAt: The date the price change becomes active (YYYY-MM-DD).
- If exact effectiveAt is not available from snippet context, set it to null.
- priceChange: The adjustment amount (e.g., 1.50 for increase, -0.60 for decrease).
- fuelType: Must be one of: Gasoline, Diesel, Kerosene.
- region: If specified (e.g., NCR), otherwise null is allowed.
- Include a short context summary per item.

Return valid JSON ONLY:
{
  "items": [
    {
      "fuelType": "Gasoline" | "Diesel" | "Kerosene",
      "pricePerLiter": number | null,
      "priceChange": number | null,
      "effectiveAt": "YYYY-MM-DD" | null,
      "region": "NCR" | "Luzon" | "Visayas" | "Mindanao" | null,
      "sourceName": string,
      "sourceUrl": string,
      "credibility": "authoritative" | "verified_report" | "unknown",
      "contextSummary": string
    }
  ],
  "confidence": number (0.0 to 1.0),
  "reasoning": "Explain why this is the latest data and identify the source's credibility."
}

Search Results:
"""
${context}
"""
`;
    try {
        const chatCompletion = await callAiProvider({
            messages: [
                {
                    role: "system",
                    content: "You are a specialized data extractor for fuel price adjustments in the Philippines. You only output valid JSON.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            response_format: { type: "json_object" },
        });
        const content = chatCompletion.choices[0]?.message?.content;
        if (!content)
            return null;
        const parsed = JSON.parse(content);
        return sanitizeExtraction(parsed, uniqueResults);
    }
    catch (error) {
        console.error("Error during Groq AI search-and-extract:", error);
        return null;
    }
}
async function refinePriceWithAi(fuelType, region, candidates, globalPrices) {
    const candidateSummary = candidates
        .map((c) => `- ${c.sourceType} (${c.sourceName}): Price=${c.pricePerLiter ?? "N/A"}, Change=${c.priceChange ?? "N/A"}, Confidence=${c.confidenceScore}, Date=${c.scrapedAt.toISOString()}`)
        .join("\n");
    const globalSummary = globalPrices
        .map((g) => `- ${g.type}: ${g.value} (${g.changePercent > 0 ? "+" : ""}${g.changePercent}%)`)
        .join("\n");
    const prompt = `
Analyze the following fuel price data points and global market indicators for ${fuelType} in ${region}, Philippines.
Your goal is to estimate the most accurate current retail pump price per liter.

HARD CONSTRAINTS:
1. Do NOT invent or hallucinate values.
2. Use only the provided candidate data points as primary evidence.
3. Global indicators can adjust confidence, but cannot create a price without candidate evidence.
4. If evidence is insufficient or contradictory, set "isReliable" to false and lower confidence.

Candidate Data Points:
${candidateSummary}

Global Indicators:
${globalSummary}

Rules:
1. "official_local" sources (DOE) are highly reliable but may be delayed.
2. "company_advisory" reflects price changes (deltas) which should be applied to the last known price.
3. "observed_station" are real-time user reports but can be outliers.
4. "global_api" (Brent/WTI) trends usually affect local prices with a 1-week lag.
5. The estimatedPrice must be within a realistic range implied by the candidate prices.
6. Return sourceReferences as exact sourceUrl values from the candidate list used in the estimate.

Return the result in JSON format only:
{
  "estimatedPrice": number,
  "confidence": number (0.0 to 1.0),
  "reasoning": "short explanation of how you derived this price",
  "isReliable": boolean (true if data is consistent, false if highly contradictory),
  "sourceReferences": string[]
}
`;
    try {
        const chatCompletion = await callAiProvider({
            messages: [
                {
                    role: "system",
                    content: "You are an expert fuel market analyst for the Philippines. You provide accurate price estimations based on mixed data sources.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            response_format: { type: "json_object" },
        });
        const content = chatCompletion.choices[0]?.message?.content;
        if (!content)
            return null;
        return JSON.parse(content);
    }
    catch (error) {
        console.error("Error during Groq AI price refinement:", error);
        return null;
    }
}
async function discoverLatestLinksWithAi(sourceUrl, rawHtml) {
    const prompt = `
Analyze the following HTML from a DOE (Department of Energy) listing page. 
Your goal is to identify the MOST RECENT and LATEST relevant PDF report link for each category.

Categories:
1. "PriceAdjustment" (usually says 'Price Adjustment' or 'Pump Prices')
2. "NCR" (Metro Manila)
3. "Luzon"
4. "Visayas"
5. "Mindanao"

Ignore archives and links that are clearly from previous years or older than the most recent one found for that category.
Return the result in JSON format only:
{
  "links": [
    {
      "url": "full absolute URL if available, otherwise relative path",
      "label": "text of the link",
      "category": "category name from list above",
      "isLatest": true
    }
  ]
}

HTML Snippet (truncated):
${rawHtml.slice(0, 12000)}
`;
    try {
        const chatCompletion = await callAiProvider({
            messages: [
                {
                    role: "system",
                    content: "You are a web discovery agent for the Philippine Department of Energy website. You only output valid JSON.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            response_format: { type: "json_object" },
        });
        const content = chatCompletion.choices[0]?.message?.content;
        if (!content)
            return null;
        return JSON.parse(content);
    }
    catch (error) {
        console.error("Error during Groq AI link discovery:", error);
        return null;
    }
}
