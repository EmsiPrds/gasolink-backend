import { noopParser } from "./noopParser";
import type { SourceParser } from "./parserTypes";
import { doeListingParser } from "./doe/doeListingParser";
import { doeArticleParser } from "./doe/doeArticleParser";
import { doePdfParser } from "./doe/doePdfParser";
import { companyGenericParser } from "./company/companyGenericParser";
import { newsGenericParser } from "./news/newsGenericParser";
import { fbPublicPageParser } from "./fb/fbPublicPageParser";

// Register real parsers here as you add source-specific implementations.
export const parsers: SourceParser[] = [
  doeListingParser,
  doeArticleParser,
  doePdfParser,
  companyGenericParser,
  newsGenericParser,
  fbPublicPageParser,
  noopParser,
];

