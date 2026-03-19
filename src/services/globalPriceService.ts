import { GlobalPrice } from "../models/GlobalPrice";
import { UpdateLog } from "../models/UpdateLog";
import type { GlobalPriceProvider } from "./providers/GlobalPriceProvider";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function computeChangePercent(type: "Brent" | "WTI" | "USDPHP", nextValue: number) {
  const prev = await GlobalPrice.findOne({ type }).sort({ timestamp: -1 }).lean();
  if (!prev || prev.value === 0) return 0;
  return round2(((nextValue - prev.value) / prev.value) * 100);
}

export async function refreshGlobalPrices(
  provider: GlobalPriceProvider,
  options?: { trigger?: "cron" | "manual" },
) {
  const trigger = options?.trigger ?? "cron";
  try {
    const snap = await provider.getLatest();
    const [brentChange, wtiChange, usdChange] = await Promise.all([
      computeChangePercent("Brent", snap.brent),
      computeChangePercent("WTI", snap.wti),
      computeChangePercent("USDPHP", snap.usdphp),
    ]);

    await GlobalPrice.insertMany([
      { type: "Brent", value: snap.brent, changePercent: brentChange, timestamp: snap.timestamp },
      { type: "WTI", value: snap.wti, changePercent: wtiChange, timestamp: snap.timestamp },
      { type: "USDPHP", value: snap.usdphp, changePercent: usdChange, timestamp: snap.timestamp },
    ]);

    await UpdateLog.create({
      module: "global",
      status: "success",
      message: `Global reference refreshed (${trigger})`,
      timestamp: new Date(),
    });

    return { ok: true as const };
  } catch (err) {
    await UpdateLog.create({
      module: "global",
      status: "failure",
      message: `Global refresh failed (${trigger}): ${err instanceof Error ? err.message : "unknown error"}`,
      timestamp: new Date(),
    });
    return { ok: false as const };
  }
}

