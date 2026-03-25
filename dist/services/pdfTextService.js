"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPdfText = extractPdfText;
const promises_1 = __importDefault(require("fs/promises"));
const http_1 = require("../utils/http");
const UpdateLog_1 = require("../models/UpdateLog");
const pdf_parse_1 = require("pdf-parse");
async function loadPdfBytes(source) {
    if ("localPath" in source) {
        return promises_1.default.readFile(source.localPath);
    }
    const fetched = await (0, http_1.fetchBinary)(source.url);
    if (fetched.status < 200 || fetched.status >= 300) {
        throw new Error(`HTTP ${fetched.status} for ${source.url}`);
    }
    return fetched.data;
}
async function primaryExtract(bytes) {
    const parser = new pdf_parse_1.PDFParse({ data: bytes });
    const parsed = await parser.getText();
    const text = parsed?.text ?? "";
    if (!text.trim()) {
        throw new Error("Empty text from pdf-parse");
    }
    if (typeof parser.destroy === "function") {
        await parser.destroy();
    }
    return text;
}
async function extractPdfText(source) {
    let bytes;
    const label = "url" in source ? source.url : source.localPath;
    try {
        bytes = await loadPdfBytes(source);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await UpdateLog_1.UpdateLog.create({
            module: "pdf_text",
            status: "failure",
            message: `Failed to load PDF (${label}): ${msg}`,
            timestamp: new Date(),
        }).catch(() => { });
        return { ok: false, error: msg };
    }
    // Primary extractor
    try {
        const text = await primaryExtract(bytes);
        return { ok: true, text };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await UpdateLog_1.UpdateLog.create({
            module: "pdf_text",
            status: "failure",
            message: `Primary PDF extractor failed (${label}): ${msg}`,
            timestamp: new Date(),
        }).catch(() => { });
        return { ok: false, error: msg };
    }
}
