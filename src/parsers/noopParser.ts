import type { SourceParser } from "./parserTypes";

/**
 * Placeholder parser.
 *
 * Each real source must have its own parser implementation; until then we fail closed.
 */
export const noopParser: SourceParser = {
  id: "noop",
  canHandle: () => true,
  parse: async () => ({ ok: false, error: "No parser configured for this source yet." }),
};

