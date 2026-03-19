import axios from "axios";

export type FetchResult = {
  url: string;
  status: number;
  contentType?: string;
  html?: string;
  text?: string;
};

export async function fetchStatic(url: string): Promise<FetchResult> {
  const res = await axios.get<string>(url, {
    // Some sources (notably DOE behind Cloudflare) can be slow; keep timeouts realistic.
    timeout: 120_000,
    responseType: "text",
    headers: {
      // Basic UA helps with simple blocks; keep conservative.
      "User-Agent": "GasolinkBot/1.0 (+https://gasolink.local)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    validateStatus: () => true,
  });

  const contentType = String(res.headers?.["content-type"] ?? "");
  const body = res.data ?? "";

  return {
    url,
    status: res.status,
    contentType,
    html: contentType.includes("html") ? body : undefined,
    text: !contentType.includes("html") ? body : undefined,
  };
}

export async function fetchBinary(url: string): Promise<{ url: string; status: number; contentType?: string; data: Buffer }> {
  const res = await axios.get<ArrayBuffer>(url, {
    timeout: 120_000,
    responseType: "arraybuffer",
    headers: {
      "User-Agent": "GasolinkBot/1.0 (+https://gasolink.local)",
      Accept: "*/*",
    },
    validateStatus: () => true,
  });

  const contentType = String(res.headers?.["content-type"] ?? "");
  const data = Buffer.from(res.data);

  return { url, status: res.status, contentType, data };
}

