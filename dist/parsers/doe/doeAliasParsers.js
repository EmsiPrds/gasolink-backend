"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doeServicesAliasParser = exports.doeNoticesAliasParser = void 0;
const doeListingParser_1 = require("./doeListingParser");
/**
 * Backward-compatible aliases.
 *
 * Older raw snapshots may have these parserId values. Treat them as listing pages
 * so they can discover DOE articles/PDFs and proceed through the pipeline.
 */
exports.doeNoticesAliasParser = {
    id: "doe_notices_alias_v1",
    canHandle: (raw) => raw.parserId === "doe_notices_v1",
    parse: async (raw) => doeListingParser_1.doeListingParser.parse(raw),
};
exports.doeServicesAliasParser = {
    id: "doe_services_alias_v1",
    canHandle: (raw) => raw.parserId === "doe_services_v1",
    parse: async (raw) => doeListingParser_1.doeListingParser.parse(raw),
};
