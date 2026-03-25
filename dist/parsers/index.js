"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsers = void 0;
const noopParser_1 = require("./noopParser");
const doeListingParser_1 = require("./doe/doeListingParser");
const doeArticleParser_1 = require("./doe/doeArticleParser");
const doePdfParser_1 = require("./doe/doePdfParser");
const doeAliasParsers_1 = require("./doe/doeAliasParsers");
const companyGenericParser_1 = require("./company/companyGenericParser");
const newsGenericParser_1 = require("./news/newsGenericParser");
const fbPublicPageParser_1 = require("./fb/fbPublicPageParser");
const groqParser_1 = require("./ai/groqParser");
// Register real parsers here as you add source-specific implementations.
exports.parsers = [
    doeAliasParsers_1.doeNoticesAliasParser,
    doeAliasParsers_1.doeServicesAliasParser,
    doeListingParser_1.doeListingParser,
    doeArticleParser_1.doeArticleParser,
    doePdfParser_1.doePdfParser,
    companyGenericParser_1.companyGenericParser,
    newsGenericParser_1.newsGenericParser,
    fbPublicPageParser_1.fbPublicPageParser,
    groqParser_1.groqParser,
    noopParser_1.noopParser,
];
