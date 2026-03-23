import { connectDb } from "../src/config/db";
import { runAllCollectors } from "../src/scrapers/runCollectors";
import { normalizePendingRawSources } from "../src/pipeline/normalizeRawSources";
import { reconcileFuelRecords } from "../src/reconciliation/reconcileFuelRecords";
import { FinalPublishedFuelPrice } from "../src/models/FinalPublishedFuelPrice";
import mongoose from "mongoose";

async function main() {
  await connectDb();
  console.log("==> 1. Running collectors...");
  const collectResults = await runAllCollectors();
  console.log("Collector items completed:", collectResults.length);
  
  console.log("==> 2. Normalizing raw sources...");
  const normalizeResults = await normalizePendingRawSources({ limit: 100 });
  console.log("Normalized processed:", normalizeResults.processed);
  
  console.log("==> 3. Reconciling fuel records...");
  const reconcileResults = await reconcileFuelRecords();
  console.log("Reconciled groups:", reconcileResults.groups, "Upserted:", reconcileResults.upserted);

  const records = await FinalPublishedFuelPrice.find().sort({ updatedAt: -1 }).limit(5);
  console.log("==> Latest Final Published Prices:");
  console.dir(records.map(r => ({ fuel: r.fuelType, region: r.region, price: r.finalPrice, source: r.displayType, status: r.finalStatus })), { depth: null });
  
  await mongoose.disconnect();
}
main().catch(console.error);
