"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchStatic = fetchStatic;
exports.fetchBinary = fetchBinary;
const axios_1 = __importDefault(require("axios"));
function isDoeUrl(url) {
    return url.includes("doe.gov.ph");
}
async function fetchStatic(url) {
    const maxAttempts = isDoeUrl(url) ? 2 : 1;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const res = await axios_1.default.get(url, {
                // DOE can be slow; keep timeouts realistic but not excessively long.
                timeout: 60_000,
                responseType: "text",
                headers: {
                    // Basic UA helps with simple blocks; keep conservative.
                    "User-Agent": "GasolinkBot/1.0 (+https://gasolink.local)",
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                validateStatus: () => true,
            });
            const contentType = String(res.headers?.["content-type"] ?? "");
            const body = res.data ?? "";
            return {
                url,
                status: res.status,
                contentType,
                html: contentType.includes("html") ? body : undefined,
                text: !contentType.includes("html") ? body : undefined,
            };
        }
        catch (e) {
            lastError = e;
            // For DOE, allow one retry on transient errors/timeouts.
            if (!isDoeUrl(url) || attempt === maxAttempts) {
                throw e;
            }
        }
    }
    // Should be unreachable, but TypeScript wants a return.
    throw lastError ?? new Error(`Failed to fetch ${url}`);
}
async function fetchBinary(url) {
    const res = await axios_1.default.get(url, {
        timeout: 120_000,
        responseType: "arraybuffer",
        headers: {
            "User-Agent": "GasolinkBot/1.0 (+https://gasolink.local)",
            Accept: "*/*",
        },
        validateStatus: () => true,
    });
    const contentType = String(res.headers?.["content-type"] ?? "");
    const data = Buffer.from(res.data);
    return { url, status: res.status, contentType, data };
}
