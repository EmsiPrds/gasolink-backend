"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confidenceForSourceType = confidenceForSourceType;
exports.statusLabelForSourceType = statusLabelForSourceType;
function confidenceForSourceType(sourceType) {
    switch (sourceType) {
        case "official_local":
            return 1.0;
        case "company_advisory":
            return 0.85;
        case "observed_station":
            return 0.5;
        case "estimate":
            return 0.25;
        case "global_api":
            return 0.9;
        default: {
            const _exhaustive = sourceType;
            return _exhaustive;
        }
    }
}
function statusLabelForSourceType(sourceType) {
    switch (sourceType) {
        case "official_local":
            return "Official";
        case "company_advisory":
            return "Advisory";
        case "observed_station":
            return "Observed";
        case "estimate":
            return "Estimate";
        case "global_api":
            return "Verified";
        default: {
            const _exhaustive = sourceType;
            return _exhaustive;
        }
    }
}
