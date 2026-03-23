import { noopParser } from "./noopParser";
import type { SourceParser } from "./parserTypes";
import { doeListingParser } from "./doe/doeListingParser";
import { doeArticleParser } from "./doe/doeArticleParser";
import { doePdfParser } from "./doe/doePdfParser";
import { doeNoticesAliasParser, doeServicesAliasParser } from "./doe/doeAliasParsers";
import { companyGenericParser } from "./company/companyGenericParser";
import { newsGenericParser } from "./news/newsGenericParser";
import { fbPublicPageParser } from "./fb/fbPublicPageParser";
import { groqParser } from "./ai/groqParser";

// Register real parsers here as you add source-specific implementations.
export const parsers: SourceParser[] = [
  doeNoticesAliasParser,
  doeServicesAliasParser,
  doeListingParser,
  doeArticleParser,
  doePdfParser,
  companyGenericParser,
  newsGenericParser,
  fbPublicPageParser,
  groqParser,
  noopParser,
];

