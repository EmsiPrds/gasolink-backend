import fs from "fs/promises";
import { fetchBinary } from "../utils/http";
import { UpdateLog } from "../models/UpdateLog";
import { PDFParse } from "pdf-parse";

export type PdfTextResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export type UrlPdfSource = { url: string };
export type LocalPdfSource = { localPath: string };

export type PdfSourceInput = UrlPdfSource | LocalPdfSource;

async function loadPdfBytes(source: PdfSourceInput): Promise<Buffer> {
  if ("localPath" in source) {
    return fs.readFile(source.localPath);
  }

  const fetched = await fetchBinary(source.url);
  if (fetched.status < 200 || fetched.status >= 300) {
    throw new Error(`HTTP ${fetched.status} for ${source.url}`);
  }
  return fetched.data;
}

async function primaryExtract(bytes: Buffer): Promise<string> {
  const parser = new PDFParse({ data: bytes });
  const parsed = await parser.getText();
  const text: string = parsed?.text ?? "";
  if (!text.trim()) {
    throw new Error("Empty text from pdf-parse");
  }
  if (typeof parser.destroy === "function") {
    await parser.destroy();
  }
  return text;
}

export async function extractPdfText(source: PdfSourceInput): Promise<PdfTextResult> {
  let bytes: Buffer;
  const label = "url" in source ? source.url : source.localPath;

  try {
    bytes = await loadPdfBytes(source);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await UpdateLog.create({
      module: "pdf_text",
      status: "failure",
      message: `Failed to load PDF (${label}): ${msg}`,
      timestamp: new Date(),
    }).catch(() => {});
    return { ok: false, error: msg };
  }

  // Primary extractor
  try {
    const text = await primaryExtract(bytes);
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await UpdateLog.create({
      module: "pdf_text",
      status: "failure",
      message: `Primary PDF extractor failed (${label}): ${msg}`,
      timestamp: new Date(),
    }).catch(() => {});
    return { ok: false, error: msg };
  }
}

