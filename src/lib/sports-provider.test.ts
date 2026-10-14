import { describe, it, expect, vi } from "vitest";
import { isStaleMatch, matchState, normalizeCricketMatch, normalizeSportmonksMatch } from "./sports-provider";
import { fetchCricketMatches, fetchSportmonksMatches, fetchWithSportsFallback } from "./sports-provider.server";

describe("verified sports provider", () => {
  it("normalizes UTC fixtures without inventing wickets or overs", () => {
    const m = normalizeCricketMatch({ id: "fixture", teams: ["India", "Australia"], dateTimeGMT: "2026-10-14T11:00:00", matchStarted: true, score: [{ inning: "India Inning 1", r: 24 }] }, "2026-10-14T11:01:00Z");
    expect(m?.score_a).toBe("24"); expect(m?.score_b).toBe(""); expect(m?.date_time).toBe("2026-10-14T11:00:00.000Z"); expect(m?.is_live).toBe(true);
  });
  it("rejects missing identities and invalid numeric scores", () => {
    expect(normalizeCricketMatch({ teams: ["A", "B"] }, "now")).toBeNull();
    expect(normalizeCricketMatch({ id: "x", teams: ["A", "B"], score: [{ r: -1 }] }, "now")).toBeNull();
  });
  it("distinguishes exceptional states and never infers a winner", () => {
    expect(matchState({ matchStarted: true }, "Match postponed")).toBe("postponed");
    expect(matchState({ matchEnded: true }, "No result")).toBe("abandoned");
    expect(matchState({}, "Team A won")).toBe("unknown");
    expect(matchState({ matchStarted: false }, "Scheduled")).toBe("upcoming");
  });
  it("marks old and missing provider timestamps stale", () => {
    expect(isStaleMatch(null, 60)).toBe(true);
    expect(isStaleMatch("2026-10-14T11:00:00Z", 60, Date.parse("2026-10-14T11:03:00Z"))).toBe(true);
  });
  it("retries transient failures without following redirects", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("down", { status: 503 })).mockResolvedValue(new Response(JSON.stringify({ status: "success", data: [] })));
    expect(await fetchCricketMatches("test-credential", fetcher)).toMatchObject({ total: 0 });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(fetcher.mock.calls[0][1].redirect).toBe("error");
  });
  it("does not retry quota errors or expose provider bodies", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("sensitive provider detail", { status: 429 }));
    await expect(fetchCricketMatches("test-credential", fetcher)).rejects.toThrow("quota"); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("normalizes fallback scores without merging provider identities", () => {
    const m = normalizeSportmonksMatch({ id: 42, name: "A vs B", starting_at: "2026-10-14 11:00:00", status: "Innings Break", live: true, localteam: { id: 1, name: "A" }, visitorteam: { id: 2, name: "B" }, runs: [{ team_id: 1, score: 120, wickets: 4, overs: 18.2, inning: 1 }] }, "2026-10-14T11:05:00Z");
    expect(m).toMatchObject({ external_id: "sportmonks:42", team_a: "A", score_a: "120/4 (18.2 ov)", is_live: true });
  });
  it("uses a fixed fallback origin and rejects malformed feeds", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] })));
    await expect(fetchSportmonksMatches("fallback-credential", fetcher)).resolves.toMatchObject({ provider: "sportmonks", total: 0 });
    expect(fetcher.mock.calls[0][0].origin).toBe("https://cricket.sportmonks.com");
    expect(fetcher.mock.calls[0][1].redirect).toBe("error");
  });
  it("falls back after primary rejection without sending primary credentials to fallback", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("denied", { status: 401 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })));
    const attempts: Array<{ provider: string; status: "healthy" | "failed" }> = [];
    expect(await fetchWithSportsFallback({ apiKey: "primary-test", fallbackProvider: "sportmonks", fallbackApiKey: "fallback-test" }, attempts, fetcher)).toMatchObject({ provider: "sportmonks" });
    expect(attempts.map(a => a.status)).toEqual(["failed", "healthy"]);
    expect(fetcher.mock.calls[1][0].searchParams.get("api_token")).toBe("fallback-test");
    expect(fetcher.mock.calls[1][0].searchParams.has("apikey")).toBe(false);
  });
  it("does not use fallback when primary succeeds, including a legitimate empty feed", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: [] })));
    await fetchWithSportsFallback({ apiKey: "primary", fallbackProvider: "sportmonks", fallbackApiKey: "fallback" }, [], fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("fails closed when both providers fail or fallback is disabled", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("private body", { status: 403 }));
    await expect(fetchWithSportsFallback({ apiKey: "primary", fallbackProvider: "none", fallbackApiKey: "unused" }, [], fetcher)).rejects.toThrow("preserved");
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(fetchWithSportsFallback({ apiKey: "primary", fallbackProvider: "sportmonks", fallbackApiKey: "fallback" }, [], fetcher)).rejects.toThrow("preserved");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});