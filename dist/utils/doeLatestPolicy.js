"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSourceUrl = normalizeSourceUrl;
exports.extractDoeDateFromUrl = extractDoeDateFromUrl;
exports.resolveDoeDocumentDate = resolveDoeDocumentDate;
exports.isWithinDays = isWithinDays;
exports.selectLatestDoeDocument = selectLatestDoeDocument;
function normalizeSourceUrl(url) {
    return url.trim().toLowerCase().replace(/[?#].*$/, "");
}
function toValidDate(value) {
    if (!value)
        return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
}
function extractDoeDateFromUrl(sourceUrl) {
    const normalized = normalizeSourceUrl(sourceUrl);
    // Prefer MMDDYYYY (DOE common pattern).
    const mmddyyyy = normalized.match(/(?:^|[^0-9])([0-1][0-9])([0-3][0-9])(20[0-9]{2})(?:[^0-9]|$)/);
    if (mmddyyyy) {
        const month = Number(mmddyyyy[1]);
        const day = Number(mmddyyyy[2]);
        const year = Number(mmddyyyy[3]);
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
            return new Date(Date.UTC(year, month - 1, day));
        }
    }
    // Fallback DDMMYYYY.
    const ddmmyyyy = normalized.match(/(?:^|[^0-9])([0-3][0-9])([0-1][0-9])(20[0-9]{2})(?:[^0-9]|$)/);
    if (ddmmyyyy) {
        const day = Number(ddmmyyyy[1]);
        const month = Number(ddmmyyyy[2]);
        const year = Number(ddmmyyyy[3]);
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
            return new Date(Date.UTC(year, month - 1, day));
        }
    }
    const iso = normalized.match(/(\d{4})[-_/](\d{2})[-_/](\d{2})/);
    if (iso) {
        const year = Number(iso[1]);
        const month = Number(iso[2]);
        const day = Number(iso[3]);
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
            return new Date(Date.UTC(year, month - 1, day));
        }
    }
    return null;
}
function resolveDoeDocumentDate(sourceUrl, fallbackDate) {
    return extractDoeDateFromUrl(sourceUrl) ?? toValidDate(fallbackDate);
}
function isWithinDays(date, now, days) {
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return date >= cutoff && date <= now;
}
function selectLatestDoeDocument(items, getSourceUrl, getFallbackDate, now, maxAgeDays) {
    let latest = null;
    for (const item of items) {
        const sourceUrl = getSourceUrl(item);
        const docDate = resolveDoeDocumentDate(sourceUrl, getFallbackDate(item));
        if (!docDate)
            continue;
        if (!isWithinDays(docDate, now, maxAgeDays))
            continue;
        if (!latest || docDate > latest.date) {
            latest = { sourceUrl: normalizeSourceUrl(sourceUrl), date: docDate };
        }
    }
    return latest;
}
