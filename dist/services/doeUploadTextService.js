"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDoeUploadText = extractDoeUploadText;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const XLSX = __importStar(require("xlsx"));
const env_1 = require("../config/env");
const pdfTextService_1 = require("./pdfTextService");
function detectUploadFormat(filename, mimeType) {
    const ext = path_1.default.extname(filename).toLowerCase();
    if (ext === ".pdf" || mimeType === "application/pdf")
        return "pdf";
    if (ext === ".csv" || mimeType?.includes("csv"))
        return "csv";
    if (ext === ".xlsx" || ext === ".xls" || mimeType?.includes("spreadsheet"))
        return "xlsx";
    if (mimeType?.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"].includes(ext)) {
        return "image";
    }
    return null;
}
function rowToText(values) {
    return values
        .map((value) => (value == null ? "" : String(value).trim()))
        .filter(Boolean)
        .join(" | ");
}
function spreadsheetToText(buffer) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const lines = [];
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
        lines.push(`Sheet: ${sheetName}`);
        for (const row of rows) {
            if (!Array.isArray(row))
                continue;
            const line = rowToText(row);
            if (line)
                lines.push(line);
        }
    }
    return lines.join("\n").trim();
}
async function extractImageTextWithOpenAi(localPath) {
    if (!env_1.env.OPENAI_API_KEY || env_1.env.OPENAI_API_KEY.includes("replace_me")) {
        return { ok: false, error: "OPENAI_API_KEY is required for image OCR uploads." };
    }
    const bytes = await promises_1.default.readFile(localPath);
    const base64 = bytes.toString("base64");
    const dataUrl = `data:image/jpeg;base64,${base64}`;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env_1.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: env_1.env.OPENAI_MODEL,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Extract all visible fuel pricing text from this DOE document image. Return plain text only.",
                        },
                        { type: "image_url", image_url: { url: dataUrl } },
                    ],
                },
            ],
        }),
    });
    if (!response.ok) {
        const body = await response.text();
        return { ok: false, error: `OpenAI OCR failed (${response.status}): ${body.slice(0, 300)}` };
    }
    const json = (await response.json());
    const text = json?.choices?.[0]?.message?.content;
    if (!text || typeof text !== "string" || !text.trim()) {
        return { ok: false, error: "OpenAI OCR returned empty text." };
    }
    return {
        ok: true,
        text,
        format: "image",
        warnings: ["Image OCR was used. Please verify extracted rows before commit."],
    };
}
async function extractDoeUploadText(params) {
    const format = detectUploadFormat(params.originalFilename, params.mimeType);
    if (!format) {
        return {
            ok: false,
            error: "Unsupported file type. Allowed: PDF, CSV, XLS/XLSX, PNG/JPG/JPEG/WEBP/GIF/BMP.",
        };
    }
    if (format === "pdf") {
        const result = await (0, pdfTextService_1.extractPdfText)({ localPath: params.localPath });
        if (!result.ok)
            return { ok: false, error: result.error };
        return { ok: true, text: result.text, format, warnings: [] };
    }
    if (format === "csv") {
        const text = await promises_1.default.readFile(params.localPath, "utf8");
        if (!text.trim())
            return { ok: false, error: "CSV file is empty." };
        return { ok: true, text, format, warnings: [] };
    }
    if (format === "xlsx") {
        const buffer = await promises_1.default.readFile(params.localPath);
        const text = spreadsheetToText(buffer);
        if (!text.trim())
            return { ok: false, error: "Spreadsheet file has no readable rows." };
        return { ok: true, text, format, warnings: [] };
    }
    return extractImageTextWithOpenAi(params.localPath);
}
