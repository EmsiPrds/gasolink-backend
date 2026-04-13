import fs from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";
import { env } from "../config/env";
import { extractPdfText } from "./pdfTextService";

export type SupportedDoeUploadFormat = "pdf" | "csv" | "xlsx" | "image";

export type DoeUploadTextResult =
  | {
      ok: true;
      text: string;
      format: SupportedDoeUploadFormat;
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
    };

function detectUploadFormat(filename: string, mimeType?: string): SupportedDoeUploadFormat | null {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf" || mimeType === "application/pdf") return "pdf";
  if (ext === ".csv" || mimeType?.includes("csv")) return "csv";
  if (ext === ".xlsx" || ext === ".xls" || mimeType?.includes("spreadsheet")) return "xlsx";
  if (mimeType?.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"].includes(ext)) {
    return "image";
  }
  return null;
}

function rowToText(values: unknown[]): string {
  return values
    .map((value) => (value == null ? "" : String(value).trim()))
    .filter(Boolean)
    .join(" | ");
}

function spreadsheetToText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false });
    lines.push(`Sheet: ${sheetName}`);
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const line = rowToText(row);
      if (line) lines.push(line);
    }
  }
  return lines.join("\n").trim();
}

async function extractImageTextWithOpenAi(localPath: string): Promise<DoeUploadTextResult> {
  if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY.includes("replace_me")) {
    return { ok: false, error: "OPENAI_API_KEY is required for image OCR uploads." };
  }

  const bytes = await fs.readFile(localPath);
  const base64 = bytes.toString("base64");
  const dataUrl = `data:image/jpeg;base64,${base64}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
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

  const json = (await response.json()) as any;
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

export async function extractDoeUploadText(params: {
  localPath: string;
  originalFilename: string;
  mimeType?: string;
}): Promise<DoeUploadTextResult> {
  const format = detectUploadFormat(params.originalFilename, params.mimeType);
  if (!format) {
    return {
      ok: false,
      error: "Unsupported file type. Allowed: PDF, CSV, XLS/XLSX, PNG/JPG/JPEG/WEBP/GIF/BMP.",
    };
  }

  if (format === "pdf") {
    const result = await extractPdfText({ localPath: params.localPath });
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, text: result.text, format, warnings: [] };
  }

  if (format === "csv") {
    const text = await fs.readFile(params.localPath, "utf8");
    if (!text.trim()) return { ok: false, error: "CSV file is empty." };
    return { ok: true, text, format, warnings: [] };
  }

  if (format === "xlsx") {
    const buffer = await fs.readFile(params.localPath);
    const text = spreadsheetToText(buffer);
    if (!text.trim()) return { ok: false, error: "Spreadsheet file has no readable rows." };
    return { ok: true, text, format, warnings: [] };
  }

  return extractImageTextWithOpenAi(params.localPath);
}
