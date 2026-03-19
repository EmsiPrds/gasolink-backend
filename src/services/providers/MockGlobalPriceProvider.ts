import { GlobalPrice } from "../../models/GlobalPrice";
import type { GlobalPriceProvider, GlobalReferenceSnapshot } from "./GlobalPriceProvider";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function nudge(current: number, maxPctMove: number) {
  const pctMove = (Math.random() - 0.5) * 2 * maxPctMove;
  return current * (1 + pctMove / 100);
}

export class MockGlobalPriceProvider implements GlobalPriceProvider {
  async getLatest(): Promise<GlobalReferenceSnapshot> {
    const ts = new Date();

    const [brentLast, wtiLast, usdLast] = await Promise.all([
      GlobalPrice.findOne({ type: "Brent" }).sort({ timestamp: -1 }).lean(),
      GlobalPrice.findOne({ type: "WTI" }).sort({ timestamp: -1 }).lean(),
      GlobalPrice.findOne({ type: "USDPHP" }).sort({ timestamp: -1 }).lean(),
    ]);

    const brentBase = brentLast?.value ?? 82;
    const wtiBase = wtiLast?.value ?? 78;
    const usdBase = usdLast?.value ?? 56.2;

    const brent = round2(clamp(nudge(brentBase, 0.6), 40, 150));
    const wti = round2(clamp(nudge(wtiBase, 0.7), 35, 140));
    const usdphp = round2(clamp(nudge(usdBase, 0.12), 40, 80));

    return { brent, wti, usdphp, timestamp: ts };
  }
}

