import axios from "axios";
import { env } from "../config/env";

export type SearchResult = {
  title: string;
  link: string;
  snippet: string;
  date?: string;
};

export async function searchWeb(query: string): Promise<SearchResult[]> {
  if (!env.SERPER_API_KEY || env.SERPER_API_KEY.includes("replace_me")) {
    console.warn("Serper API key not configured. Search skipped.");
    return [];
  }

  try {
    const response = await axios.post(
      "https://google.serper.dev/search",
      {
        q: query,
        gl: "ph", // Philippines
        hl: "en",
        num: 10,
        tbs: "qdr:w", // Results from the past week
      },
      {
        headers: {
          "X-API-KEY": env.SERPER_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const toResults = (data: any): SearchResult[] => {
      const results: SearchResult[] = [];
      if (data?.organic) {
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
    };

    const primaryResults = toResults(response.data);
    if (primaryResults.length > 0) return primaryResults;

    // Fallback: if "past week" strict filter yields empty, retry a broader search.
    const fallbackResponse = await axios.post(
      "https://google.serper.dev/search",
      {
        q: query,
        gl: "ph",
        hl: "en",
        num: 10,
      },
      {
        headers: {
          "X-API-KEY": env.SERPER_API_KEY,
          "Content-Type": "application/json",
        },
      },
    );
    return toResults(fallbackResponse.data);
  } catch (error) {
    console.error("Error during Serper web search:", error);
    return [];
  }
}
