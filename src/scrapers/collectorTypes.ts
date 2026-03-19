import type { RawScrapedSourceDoc } from "../models/RawScrapedSource";
import type { SourceDefinition } from "../sources/types";

export type CollectorRunResult = {
  sourceId: string;
  ok: boolean;
  raw?: RawScrapedSourceDoc;
  error?: string;
};

export type Collector = {
  name: string;
  canHandle: (src: SourceDefinition) => boolean;
  runOne: (src: SourceDefinition) => Promise<CollectorRunResult>;
};

