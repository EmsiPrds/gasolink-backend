"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256Hex = sha256Hex;
exports.buildFingerprint = buildFingerprint;
const node_crypto_1 = __importDefault(require("node:crypto"));
function sha256Hex(input) {
    return node_crypto_1.default.createHash("sha256").update(input).digest("hex");
}
function buildFingerprint(parts) {
    // Stable stringification for deterministic hashing (sort keys shallowly).
    const keys = Object.keys(parts).sort();
    const stable = {};
    for (const k of keys)
        stable[k] = parts[k];
    return sha256Hex(JSON.stringify(stable));
}
