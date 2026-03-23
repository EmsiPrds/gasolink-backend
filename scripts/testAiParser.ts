import { connectDb } from "../src/config/db";
import mongoose from "mongoose";
import { groqParser } from "../src/parsers/ai/groqParser";
import { RawScrapedSource } from "../src/models/RawScrapedSource";

async function main() {
  await connectDb();
  console.log("==> Testing Groq AI Parser...");

  const testText = `
    PETRON ADVISORY:
    Petron will implement a price increase effective March 23, 2026.
    Gasoline will increase by 1.50 per liter.
    Diesel will increase by 0.75 per liter.
    Kerosene will increase by 0.50 per liter.
    This applies to all Petron stations nationwide.
  `;

  const dummyRaw = new RawScrapedSource({
    sourceType: "company_advisory",
    sourceName: "Petron Test",
    sourceUrl: "https://www.petron.com/test",
    parserId: "ai_groq_v1",
    rawText: testText,
    scrapedAt: new Date(),
    parserVersion: "v1",
    processingStatus: "raw",
  });

  try {
    console.log("Calling groqParser.parse...");
    const result = await groqParser.parse(dummyRaw as any);
    if (result.ok) {
      console.log("Success! Extracted items:");
      console.dir(result.items, { depth: null });
    } else {
      console.error("Parser failed:", result.error);
    }
  } catch (err: any) {
    console.error("Caught error:", err.message);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
