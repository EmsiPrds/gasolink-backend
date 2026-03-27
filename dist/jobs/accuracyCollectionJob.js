"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAccuracyFirstCollection = runAccuracyFirstCollection;
const aiSearchJob_1 = require("./aiSearchJob");
async function runAccuracyFirstCollection() {
    const aiFallback = {
        ...(await (0, aiSearchJob_1.runAiSearchDataGathering)({
            skipReconcile: true,
            degradeToEstimate: false,
            requireEffectivity: true,
            requireRegion: true,
        })),
        ran: true,
        reason: "Automated collection now uses AI-native ingestion only.",
    };
    return {
        officialCollection: { attempted: 0, created: 0, skippedUnchanged: 0, failed: 0, scope: "official" },
        normalization: { passes: 0, processed: 0, normalized: 0, failed: 0 },
        aiFallback,
    };
}
