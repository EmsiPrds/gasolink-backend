"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchStatic = fetchStatic;
exports.fetchDynamic = fetchDynamic;
exports.fetchBinary = fetchBinary;
const axios_1 = __importDefault(require("axios"));
const playwright_1 = require("playwright");
async function fetchStatic(url) {
    try {
        const response = await axios_1.default.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            timeout: 10000,
        });
        return {
            status: response.status,
            html: response.data,
            text: response.data, // For static HTML, we treat text and html similarly for now
        };
    }
    catch (error) {
        return {
            status: error.response?.status || 500,
            html: "",
            text: "",
        };
    }
}
async function fetchDynamic(url) {
    let browser = null;
    try {
        browser = await playwright_1.chromium.launch({ headless: true });
        const page = await browser.newPage({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        });
        const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => { });
        const html = await page.content();
        const text = await page.textContent("body");
        return {
            status: response?.status() ?? 200,
            html,
            text: text ?? "",
        };
    }
    catch (error) {
        return {
            status: error?.response?.status || 500,
            html: "",
            text: "",
        };
    }
    finally {
        if (browser) {
            await browser.close().catch(() => { });
        }
    }
}
async function fetchBinary(url) {
    try {
        const response = await axios_1.default.get(url, {
            responseType: "arraybuffer",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            timeout: 15000,
        });
        return {
            status: response.status,
            data: Buffer.from(response.data),
        };
    }
    catch (error) {
        return {
            status: error.response?.status || 500,
            data: Buffer.alloc(0),
        };
    }
}
