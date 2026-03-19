"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessingStatusValues = exports.StatusLabelValues = exports.SourceTypeValues = exports.UpdateLogStatusValues = exports.InsightStatusValues = exports.AlertLevelValues = exports.GlobalPriceTypeValues = exports.FuelTypeValues = exports.RegionValues = exports.PriceStatusValues = void 0;
exports.PriceStatusValues = ["Verified", "Advisory", "Estimate"];
exports.RegionValues = ["NCR", "Luzon", "Visayas", "Mindanao"];
exports.FuelTypeValues = ["Gasoline", "Diesel", "Kerosene"];
exports.GlobalPriceTypeValues = ["Brent", "WTI", "USDPHP"];
exports.AlertLevelValues = ["info", "warning", "critical"];
exports.InsightStatusValues = ["active", "inactive"];
exports.UpdateLogStatusValues = ["success", "failure"];
// Accuracy-first pipeline (source-aware data classification)
exports.SourceTypeValues = [
    "global_api",
    "official_local",
    "company_advisory",
    "observed_station",
    "estimate",
];
exports.StatusLabelValues = ["Verified", "Official", "Advisory", "Observed", "Estimate"];
exports.ProcessingStatusValues = ["raw", "normalized", "failed"];
