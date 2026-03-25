"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchWeb = searchWeb;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
async function searchWeb(query) {
    if (!env_1.env.SERPER_API_KEY || env_1.env.SERPER_API_KEY.includes("replace_me")) {
        console.warn("Serper API key not configured. Search skipped.");
        return [];
    }
    try {
        const response = await axios_1.default.post("https://google.serper.dev/search", {
            q: query,
            gl: "ph", // Philippines
            hl: "en",
            num: 10,
            tbs: "qdr:w", // Results from the past week
        }, {
            headers: {
                "X-API-KEY": env_1.env.SERPER_API_KEY,
                "Content-Type": "application/json",
            },
        });
        const data = response.data;
        const results = [];
        if (data.organic) {
            for (const res of data.organic) {
                results.push({
                    title: res.title,
                    link: res.link,
                    snippet: res.snippet,
                    date: res.date,
                });
            }
        }
        return results;
    }
    catch (error) {
        console.error("Error during Serper web search:", error);
        return [];
    }
}
