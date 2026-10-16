import { describe, expect, it } from "vitest";
import { normalizeBalls } from "./ball-feed";
import { rowToFacts, rowToRef, winnerFromStatus, type MatchRow } from "./facts";

const NOW = Date.parse("2026-10-16T10:00:00Z");
const base = (over: Partial<MatchRow> = {}): MatchRow => ({
  id: "m1", name: "India vs Australia", status: "Match not started", date_time: "2026-10-16T11:00:00Z",
  team_a: "India", team_b: "Australia", match_type: "T20", is_live: false,
  raw: { matchStarted: false, matchEnded: false }, fetched_at: "2026-10-16T09:59:30Z", ...over,
});

describe("rowToRef", () => {
  it("maps provider state and normalises the format", () => {
    const ref = rowToRef(base());
    expect(ref).toMatchObject({ id: "m1", sport: "cricket", format: "t20", state: "upcoming", teamA: "India" });
  });
  it("detects abandoned / postponed / cancelled from the status text", () => {
    expect(rowToRef(base({ status: "Match abandoned without a ball bowled" })).state).toBe("abandoned");
    expect(rowToRef(base({ status: "Postponed due to rain" })).state).toBe("postponed");
    expect(rowToRef(base({ status: "Cancelled" })).state).toBe("cancelled");
  });
});

describe("winnerFromStatus", () => {
  it("reads the winner only when the status says so", () => {
    expect(winnerFromStatus("India won by 5 runs", "India", "Australia")).toBe("A");
    expect(winnerFromStatus("Australia won by 3 wkts", "India", "Australia")).toBe("B");
    // Conservative by design: a tie is never turned into a winner from free text.
    // The engine voids the question (or uses a draw option) instead of guessing.
    expect(winnerFromStatus("Match tied (India won the Super Over)", "India", "Australia")).toBe("tie");
    expect(winnerFromStatus("Match tied", "India", "Australia")).toBe("tie");
  });
  it("returns null for no result, abandoned, empty or unknown teams", () => {
    expect(winnerFromStatus("No result", "India", "Australia")).toBeNull();
    expect(winnerFromStatus("Match abandoned", "India", "Australia")).toBeNull();
    expect(winnerFromStatus("", "India", "Australia")).toBeNull();
    expect(winnerFromStatus("Zimbabwe won by 2 runs", "India", "Australia")).toBeNull();
  });
});

describe("rowToFacts", () => {
  const liveRaw = {
    matchStarted: true, matchEnded: false,
    score: [
      { r: 182, w: 6, o: 20, inning: "India Inning 1" },
      { r: 40, w: 1, o: 4.2, inning: "Australia Inning 1" },
    ],
  };

  it("builds innings with conservative 'complete' flags", () => {
    const facts = rowToFacts(base({ is_live: true, status: "Live", raw: liveRaw }), { nowMs: NOW, refreshSeconds: 60 })!;
    expect(facts.state).toBe("live");
    expect(facts.innings).toEqual([
      { no: 1, team: "India", runs: 182, wickets: 6, overs: 20, complete: true },
      { no: 2, team: "Australia", runs: 40, wickets: 1, overs: 4.2, complete: false },
    ]);
    expect(facts.winner).toBeNull();
  });

  it("never marks the batting innings complete before the limit", () => {
    const raw = { matchStarted: true, matchEnded: false, score: [{ r: 90, w: 3, o: 11, inning: "India Inning 1" }] };
    const facts = rowToFacts(base({ is_live: true, raw }), { nowMs: NOW, refreshSeconds: 60 })!;
    expect(facts.innings[0].complete).toBe(false);
  });

  it("rejects stale live data (blocks settlement from old numbers)", () => {
    const stale = base({ is_live: true, raw: liveRaw, fetched_at: "2026-10-16T09:00:00Z" });
    expect(rowToFacts(stale, { nowMs: NOW, refreshSeconds: 60 })).toBeNull();
  });

  it("reads the official winner once the match has ended", () => {
    const raw = { ...liveRaw, matchEnded: true };
    const facts = rowToFacts(base({ status: "India won by 20 runs", raw, fetched_at: "2026-10-15T00:00:00Z" }), { nowMs: NOW, refreshSeconds: 60 })!;
    expect(facts.state).toBe("completed");
    expect(facts.winner).toBe("A");
    expect(facts.innings.every((i) => i.complete)).toBe(true);
  });

  it("returns null when the provider state is unknown", () => {
    expect(rowToFacts(base({ raw: {} }), { nowMs: NOW, refreshSeconds: 60 })).toBeNull();
  });

  it("parses Sportmonks runs", () => {
    const raw = {
      provider: "sportmonks", matchStarted: true, matchEnded: true,
      localteam: { id: 1, name: "India" }, visitorteam: { id: 2, name: "Australia" },
      runs: [{ team_id: 2, score: 150, wickets: 10, overs: 19.2, inning: 2 }, { team_id: 1, score: 170, wickets: 5, overs: 20, inning: 1 }],
    };
    const facts = rowToFacts(base({ status: "Finished — India won by 20 runs", raw }), { nowMs: NOW, refreshSeconds: 60 })!;
    expect(facts.innings.map((i) => [i.no, i.team, i.runs])).toEqual([[1, "India", 170], [2, "Australia", 150]]);
    expect(facts.winner).toBe("A");
  });
});

describe("normalizeBalls (fail closed)", () => {
  const good = { inning: 1, over: 1, ball: 1, legal: true, runs_bat: 4, extras: 0, wicket: false };

  it("accepts well-formed rows and collapses duplicates", () => {
    const r = normalizeBalls({ data: { bbb: [good, good, { ...good, ball: 2, runs_bat: 0, wicket: true }] } });
    expect(r.total).toBe(3);
    expect(r.rejected).toBe(0);
    expect(r.events.map((e) => e.eventKey)).toEqual(["1.1.1", "1.1.2"]);
  });

  it("treats wides and no-balls as illegal deliveries", () => {
    const { legal: _l, ...noLegal } = good;
    const r = normalizeBalls({ data: [{ ...noLegal, extra_type: "wide", extras: 1, runs_bat: 0 }, { ...noLegal, ball: 2, extra_type: "" }] });
    expect(r.events.map((e) => e.legal)).toEqual([false, true]);
  });

  it("rejects ambiguous or incomplete rows instead of guessing", () => {
    const r = normalizeBalls({ data: { bbb: [{ ...good, over: "0.3" }, { inning: 1, over: 1 }, "x", { ...good, runs_bat: -1 }] } });
    expect(r.events).toHaveLength(0);
    expect(r.rejected).toBe(4);
  });

  it("returns nothing for an unrecognised payload", () => {
    expect(normalizeBalls({ status: "failure" })).toEqual({ events: [], total: 0, rejected: 0 });
    expect(normalizeBalls(null).events).toEqual([]);
  });
});
