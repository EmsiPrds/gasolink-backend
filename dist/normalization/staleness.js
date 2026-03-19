"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maxAgeMsForSourceType = maxAgeMsForSourceType;
exports.isStale = isStale;
function maxAgeMsForSourceType(sourceType) {
    switch (sourceType) {
        case "global_api":
            return 10 * 60 * 1000; // 10 minutes
        case "official_local":
            return 7 * 24 * 60 * 60 * 1000; // 7 days (weekly cycle)
        case "company_advisory":
            return 7 * 24 * 60 * 60 * 1000;
        case "observed_station":
            return 48 * 60 * 60 * 1000; // 48 hours
        case "estimate":
            return 24 * 60 * 60 * 1000; // 24 hours
        default: {
            const _exhaustive = sourceType;
            return _exhaustive;
        }
    }
}
function isStale(sourceType, lastVerifiedAt, now = new Date()) {
    return now.getTime() - lastVerifiedAt.getTime() > maxAgeMsForSourceType(sourceType);
}
