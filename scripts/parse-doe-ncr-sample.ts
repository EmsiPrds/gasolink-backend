/// <reference types="node" />
import { extractPdfText } from "../src/services/pdfTextService";

async function main() {
  const localPath = process.argv[2];
  if (!localPath) {
    console.error("Usage: tsx scripts/parse-doe-ncr-sample.ts <path-to-local-pdf>");
    process.exit(1);
  }

  const res = await extractPdfText({ localPath });
  if (!res.ok) {
    console.error("Failed to extract PDF text:", res.error);
    process.exit(1);
  }

  const text = res.text;
  console.log("=== First 4000 chars ===");
  console.log(text.slice(0, 4000));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

