import assert from "node:assert/strict";
import test from "node:test";
import { clamp, confidenceLabel, removeOutliers } from "./aiPriceEstimation";

test("removeOutliers removes extreme value", () => {
  const cleaned = removeOutliers([60, 61, 62, 95, 61.5, 60.8]);
  assert.equal(cleaned.includes(95), false);
  assert.equal(cleaned.length >= 4, true);
});

test("confidenceLabel maps score buckets", () => {
  assert.equal(confidenceLabel(0.3), "Low");
  assert.equal(confidenceLabel(0.6), "Medium");
  assert.equal(confidenceLabel(0.8), "High");
  assert.equal(confidenceLabel(0.95), "Very High");
});

test("clamp constrains value to range", () => {
  assert.equal(clamp(2), 1);
  assert.equal(clamp(-1), 0);
  assert.equal(clamp(0.4), 0.4);
});
