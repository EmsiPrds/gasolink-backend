"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noopParser = void 0;
/**
 * Placeholder parser.
 *
 * Each real source must have its own parser implementation; until then we fail closed.
 */
exports.noopParser = {
    id: "noop",
    canHandle: () => true,
    parse: async () => ({ ok: false, error: "No parser configured for this source yet." }),
};
