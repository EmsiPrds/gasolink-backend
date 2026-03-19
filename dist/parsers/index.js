"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsers = void 0;
const noopParser_1 = require("./noopParser");
const doeListingParser_1 = require("./doe/doeListingParser");
const doeArticleParser_1 = require("./doe/doeArticleParser");
const doePdfParser_1 = require("./doe/doePdfParser");
const companyGenericParser_1 = require("./company/companyGenericParser");
const newsGenericParser_1 = require("./news/newsGenericParser");
const fbPublicPageParser_1 = require("./fb/fbPublicPageParser");
// Register real parsers here as you add source-specific implementations.
exports.parsers = [
    doeListingParser_1.doeListingParser,
    doeArticleParser_1.doeArticleParser,
    doePdfParser_1.doePdfParser,
    companyGenericParser_1.companyGenericParser,
    newsGenericParser_1.newsGenericParser,
    fbPublicPageParser_1.fbPublicPageParser,
    noopParser_1.noopParser,
];
