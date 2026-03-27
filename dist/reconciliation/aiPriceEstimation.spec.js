"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const aiPriceEstimation_1 = require("./aiPriceEstimation");
(0, node_test_1.default)("removeOutliers removes extreme value", () => {
    const cleaned = (0, aiPriceEstimation_1.removeOutliers)([60, 61, 62, 95, 61.5, 60.8]);
    strict_1.default.equal(cleaned.includes(95), false);
    strict_1.default.equal(cleaned.length >= 4, true);
});
(0, node_test_1.default)("confidenceLabel maps score buckets", () => {
    strict_1.default.equal((0, aiPriceEstimation_1.confidenceLabel)(0.3), "Low");
    strict_1.default.equal((0, aiPriceEstimation_1.confidenceLabel)(0.6), "Medium");
    strict_1.default.equal((0, aiPriceEstimation_1.confidenceLabel)(0.8), "High");
    strict_1.default.equal((0, aiPriceEstimation_1.confidenceLabel)(0.95), "Very High");
});
(0, node_test_1.default)("clamp constrains value to range", () => {
    strict_1.default.equal((0, aiPriceEstimation_1.clamp)(2), 1);
    strict_1.default.equal((0, aiPriceEstimation_1.clamp)(-1), 0);
    strict_1.default.equal((0, aiPriceEstimation_1.clamp)(0.4), 0.4);
});
