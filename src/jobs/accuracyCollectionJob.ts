import { runAiSearchDataGathering } from "./aiSearchJob";
type AiFallbackSummary = Awaited<ReturnType<typeof runAiSearchDataGathering>>;

export async function runAccuracyFirstCollection() {
  const aiFallback: AiFallbackSummary & { ran: true; reason: string } = {
    ...(await runAiSearchDataGathering({
      skipReconcile: true,
      degradeToEstimate: false,
      requireEffectivity: true,
      requireRegion: true,
    })),
    ran: true,
    reason: "Automated collection now uses AI-native ingestion only.",
  };
  return {
    officialCollection: { attempted: 0, created: 0, skippedUnchanged: 0, failed: 0, scope: "official" as const },
    normalization: { passes: 0, processed: 0, normalized: 0, failed: 0 },
    aiFallback,
  };
}
