import cron from "node-cron";
import { MockGlobalPriceProvider } from "../services/providers/MockGlobalPriceProvider";
import { refreshGlobalPrices } from "../services/globalPriceService";

const provider = new MockGlobalPriceProvider();

export function startGlobalPriceJob() {
  // Every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    await refreshGlobalPrices(provider, { trigger: "cron" });
  });
}

