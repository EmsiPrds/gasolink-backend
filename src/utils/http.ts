import axios from "axios";
import { chromium } from "playwright";

export interface FetchResult {
  status: number;
  html: string;
  text: string;
  data?: any;
}

export async function fetchStatic(url: string): Promise<FetchResult> {
  try {
    const response = await axios.get(url, {
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
  } catch (error: any) {
    return {
      status: error.response?.status || 500,
      html: "",
      text: "",
    };
  }
}

export async function fetchDynamic(url: string): Promise<FetchResult> {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const html = await page.content();
    const text = await page.textContent("body");

    return {
      status: response?.status() ?? 200,
      html,
      text: text ?? "",
    };
  } catch (error: any) {
    return {
      status: error?.response?.status || 500,
      html: "",
      text: "",
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

export async function fetchBinary(url: string): Promise<{ status: number; data: Buffer }> {
  try {
    const response = await axios.get(url, {
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
  } catch (error: any) {
    return {
      status: error.response?.status || 500,
      data: Buffer.alloc(0),
    };
  }
}
