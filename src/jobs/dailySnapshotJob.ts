import cron from "node-cron";
import { MockGlobalPriceProvider } from "../services/providers/MockGlobalPriceProvider";
import { refreshGlobalPrices } from "../services/globalPriceService";

const provider = new MockGlobalPriceProvider();

export function startDailySnapshotJob() {
  // Daily at 03:05 (PH time depends on server; adjust in production via timezone handling)
  cron.schedule("5 3 * * *", async () => {
    await refreshGlobalPrices(provider, { trigger: "cron" });
  });
}

