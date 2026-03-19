const { extractPdfText } = require("../dist/services/pdfTextService");
const { doePdfParser } = require("../dist/parsers/doe/doePdfParser");

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: node scripts/test-doe-url.js <pdf-url>");
    process.exit(1);
  }

  console.log("Fetching and extracting PDF:", url);
  const res = await extractPdfText({ url });
  if (!res.ok) {
    console.error("extractPdfText failed:", res.error);
    process.exit(2);
  }

  const raw = {
    sourceUrl: url,
    sourceName: "DOE Test",
    sourceType: "official_local",
    parserId: "doe_pdf_v1",
    rawText: res.text,
    rawHtml: null,
    scrapedAt: new Date(),
    parserVersion: "v1",
  };

  const parseRes = await doePdfParser.parse(raw);
  if (!parseRes.ok) {
    console.error("Parse failed:", parseRes.error);
    process.exit(3);
  }

  console.log("Parsed items:", parseRes.items.length);
  console.log(JSON.stringify(parseRes.items, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
