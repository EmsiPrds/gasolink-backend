import axios from "axios";

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
