import { describe, it, expect, vi } from "vitest";
import { isStaleMatch, matchState, normalizeCricketMatch } from "./sports-provider";
import { fetchCricketMatches } from "./sports-provider.server";

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
});