import { normalizeCricketMatch } from "@/lib/sports-provider";

/** Fixed provider origin: credentials never follow redirects or requester-selected destinations. */
export async function fetchCricketMatches(apiKey: string, fetcher: typeof fetch = fetch) {
  const url = new URL("https://api.cricapi.com/v1/currentMatches");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("offset", "0");
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(10000) });
    } catch {
      if (attempt < 2) continue;
      throw new Error("Sports provider could not be reached. Last verified scores were preserved.");
    }
    if (response.status === 429) throw new Error("Sports provider quota exceeded. Retry after your provider quota resets.");
    if (response.status >= 500 && attempt < 2) { await response.body?.cancel(); continue; }
    if (!response.ok) throw new Error(`Sports provider request failed (HTTP ${response.status}).`);
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new Error("Sports provider returned invalid JSON."); }
    if (!payload || typeof payload !== "object") throw new Error("Sports provider returned an invalid match feed.");
    const feed = payload as Record<string, unknown>;
    if (feed.status !== "success" || !Array.isArray(feed.data)) throw new Error("Sports provider rejected the request or did not return match data. Check credential and plan access.");
    const now = new Date().toISOString();
    const rows = feed.data.map(item => normalizeCricketMatch(item, now)).filter(row => row !== null);
    return { rows, total: feed.data.length, rejected: feed.data.length - rows.length };
  }
  throw new Error("Sports provider is temporarily unavailable.");
}