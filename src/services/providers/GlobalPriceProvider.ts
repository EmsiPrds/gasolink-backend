export type GlobalReferenceSnapshot = {
  brent: number;
  wti: number;
  usdphp: number;
  timestamp: Date;
};

export interface GlobalPriceProvider {
  getLatest(): Promise<GlobalReferenceSnapshot>;
}

