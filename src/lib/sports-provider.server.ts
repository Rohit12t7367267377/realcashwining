import { normalizeCricketMatch, normalizeSportmonksMatch, type SportsProviderId } from "@/lib/sports-provider";

type ProviderFeed = { rows: NonNullable<ReturnType<typeof normalizeCricketMatch>>[]; total: number; rejected: number; provider: SportsProviderId };

async function requestJson(url: URL, fetcher: typeof fetch, providerName: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try { response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(10000) }); }
    catch { if (attempt < 2) continue; throw new Error(`${providerName} could not be reached.`); }
    if (response.status === 429) throw new Error(`${providerName} quota exceeded.`);
    if (response.status >= 500 && attempt < 2) { await response.body?.cancel(); continue; }
    if (!response.ok) throw new Error(`${providerName} request failed (HTTP ${response.status}).`);
    try { return await response.json() as unknown; } catch { throw new Error(`${providerName} returned invalid JSON.`); }
  }
  throw new Error(`${providerName} is temporarily unavailable.`);
}

/** Fixed provider origin: credentials never follow redirects or requester-selected destinations. */
export async function fetchCricketMatches(apiKey: string, fetcher: typeof fetch = fetch): Promise<ProviderFeed> {
  const url = new URL("https://api.cricapi.com/v1/currentMatches");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("offset", "0");
  const payload = await requestJson(url, fetcher, "CricAPI");
  if (!payload || typeof payload !== "object") throw new Error("CricAPI returned an invalid match feed.");
  const feed = payload as Record<string, unknown>;
  if (feed.status !== "success" || !Array.isArray(feed.data)) throw new Error("CricAPI rejected the request or did not return match data.");
  const now = new Date().toISOString();
  const rows = feed.data.map(item => normalizeCricketMatch(item, now)).filter(row => row !== null);
  if (feed.data.length && !rows.length) throw new Error("CricAPI returned no valid matches.");
  return { rows, total: feed.data.length, rejected: feed.data.length - rows.length, provider: "cricapi" };
}

/** Fixed Sportmonks origin; only administrator-stored credentials are accepted. */
export async function fetchSportmonksMatches(apiKey: string, fetcher: typeof fetch = fetch): Promise<ProviderFeed> {
  const url = new URL("https://cricket.sportmonks.com/api/v2.0/livescores");
  url.searchParams.set("api_token", apiKey);
  url.searchParams.set("include", "localteam,visitorteam,runs,league,venue");
  const payload = await requestJson(url, fetcher, "Fallback provider");
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as Record<string, unknown>).data)) throw new Error("Fallback provider did not return match data.");
  const data = (payload as { data: unknown[] }).data;
  const now = new Date().toISOString();
  const rows = data.map(item => normalizeSportmonksMatch(item, now)).filter(row => row !== null);
  if (data.length && !rows.length) throw new Error("Fallback provider returned no valid matches.");
  return { rows, total: data.length, rejected: data.length - rows.length, provider: "sportmonks" };
}

export async function fetchWithSportsFallback(config: { apiKey: string; fallbackProvider: "none" | "sportmonks"; fallbackApiKey: string }, attempts: Array<{ provider: string; status: "healthy" | "failed"; error?: string }>, fetcher: typeof fetch = fetch) {
  const candidates: Array<{ provider: SportsProviderId; key: string }> = [{ provider: "cricapi", key: config.apiKey }];
  if (config.fallbackProvider === "sportmonks") candidates.push({ provider: "sportmonks", key: config.fallbackApiKey });
  for (const candidate of candidates) {
    if (!candidate.key) { attempts.push({ provider: candidate.provider, status: "failed", error: "Credential is not configured." }); continue; }
    try {
      const feed = await fetchProviderMatches(candidate.provider, candidate.key, fetcher);
      attempts.push({ provider: candidate.provider, status: "healthy" });
      return feed;
    } catch (err) { attempts.push({ provider: candidate.provider, status: "failed", error: err instanceof Error ? err.message : "Provider unavailable." }); }
  }
  throw new Error("No configured sports provider is available. Last verified scores were preserved.");
}

export async function fetchProviderMatches(provider: SportsProviderId, apiKey: string, fetcher: typeof fetch = fetch) {
  return provider === "sportmonks" ? fetchSportmonksMatches(apiKey, fetcher) : fetchCricketMatches(apiKey, fetcher);
}