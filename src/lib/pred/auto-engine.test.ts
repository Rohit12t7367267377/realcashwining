// Tests for the fully automatic contest engine: generation ~3h before start, per-over delivery markets,
// virtual-points entry / pool / refunds, lifecycle states, operator controls and idempotent recovery.
// They run against the in-memory store, which enforces the same uniqueness and state rules as the database
// (the SQL itself is exercised separately by sql-economy.test.ts when a Postgres engine is available).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyDelivery, defaultOptionIds, mapToOffered, validateOptionIds } from "./delivery";
import { planPool, validatePrizeSplit } from "./economy";
import { cancelContest, generateContests, emptyReport, rerunContest, runTick as engineTick } from "./engine";
import { MemoryStore } from "./memory-store";
import { resolveQuestion } from "./outcomes";
import {
  BALL_MARKET_SCORING, BALL_MARKET_TIMING, DEFAULT_ENTRY_FEE, DEFAULT_PRIZE_SPLIT,
  type BallEvent, type ContestTemplate, type MatchFacts, type MatchRef,
} from "./types";

const MIN = 60_000;
const T0 = Date.parse("2026-10-20T11:00:00.000Z"); // scheduled match start
const iso = (ms: number) => new Date(ms).toISOString();
const runTick = (s: MemoryStore, ms: number) => { s.clock = () => ms; return engineTick(s, ms); };

const match = (over: Partial<MatchRef> = {}): MatchRef => ({
  id: "m1", sport: "cricket", format: "T20", startsAt: iso(T0), state: "upcoming", teamA: "India", teamB: "Australia", statusText: "Match not started", ...over,
});
const facts = (over: Partial<MatchFacts> = {}): MatchFacts => ({
  matchId: "m1", state: "live", statusText: "Live", teamA: "India", teamB: "Australia", winner: null, innings: [], verifiedAt: iso(T0), ...over,
});
const ballTemplate = (over: Partial<ContestTemplate> = {}): ContestTemplate => ({
  id: "t-balls", categoryId: null, name: "Ball by ball · every over", sport: "cricket", formats: ["t20"],
  plan: { generator: "over_markets", marketMode: "legal", inningsList: [1, 2] },
  timing: { ...BALL_MARKET_TIMING }, scoring: { ...BALL_MARKET_SCORING }, participantLimit: null,
  entryFee: DEFAULT_ENTRY_FEE, minParticipants: 2, prizeSplit: [...DEFAULT_PRIZE_SPLIT],
  autoGenerate: true, requireApproval: false, allowEdit: false, enabled: true, ...over,
});
const setup = (tpl: Partial<ContestTemplate> = {}, m: Partial<MatchRef> = {}) => {
  const s = new MemoryStore();
  s.matches.set("m1", match(m));
  s.templates = [ballTemplate(tpl)];
  return s;
};
let seq = 0;
const ball = (over: number, n: number, o: Partial<BallEvent> = {}): Omit<BallEvent, "revision" | "matchId"> => ({
  eventKey: `k${++seq}-${over}.${n}`, innings: 1, over, seq: n, legal: true, runsBat: 0, extras: 0, wicket: false, ...o,
});
const fund = (s: MemoryStore, user: string, amount: number) => { s.ledger.set(`seed:${user}`, { userId: user, amount, kind: "welcome_bonus", refKey: `seed:${user}`, at: 0 }); };
const contestFor = (s: MemoryStore, innings: number, over: number) =>
  [...s.contests.values()].find((c) => c.title.includes(`Innings ${innings} · Over ${over}`))!;

/** Generates, opens and returns the over-1 / innings-1 contest with funded players. */
async function openOver1(s: MemoryStore, players: string[] = []) {
  await runTick(s, T0 - 180 * MIN);
  await runTick(s, T0 - 179 * MIN);
  const c = contestFor(s, 1, 1);
  for (const p of players) fund(s, p, 100);
  return c;
}

// ---------------------------------------------------------------------------
describe("1-2. automatic generation ~3h before the match, exactly once", () => {
  it("creates every over of both innings 3 hours before start, with six slots each", async () => {
    const s = setup();
    expect((await runTick(s, T0 - 181 * MIN)).generated).toBe(0); // too early
    const r = await runTick(s, T0 - 180 * MIN);
    expect(r.generated).toBe(40); // 20 overs x 2 innings
    const c = contestFor(s, 1, 1);
    expect(c.entryFee).toBe(13);
    expect(c.prizeSplit).toEqual([70]);
    expect(c.opensAt).toBe(iso(T0 - 180 * MIN));
    const qs = await s.listQuestions(c.id);
    expect(qs).toHaveLength(6);
    expect(qs.every((q) => q.points === 2)).toBe(true);
    expect(qs[0].options.map((o) => o.id)).toEqual(["dot", "run1", "run2", "run3", "four", "six", "wicket", "other"]);
  });
  it("running the scheduler again (or after a restart) never duplicates contests", async () => {
    const s = setup();
    await runTick(s, T0 - 180 * MIN);
    const again = await runTick(s, T0 - 179 * MIN);
    await runTick(s, T0 - 150 * MIN);
    expect(again.generated).toBe(0);
    expect(s.contests.size).toBe(40);
    expect(new Set([...s.contests.values()].map((c) => c.generationKey)).size).toBe(40);
  });
  it("discovered late: shortened window if still open, nothing if the lock has passed", async () => {
    const late = setup();
    expect((await runTick(late, T0 - 60 * MIN)).generated).toBe(40);
    expect(contestFor(late, 1, 1).opensAt).toBe(iso(T0 - 60 * MIN));
    const tooLate = setup();
    expect((await runTick(tooLate, T0 - 4 * MIN)).generated).toBe(0);
    expect(tooLate.contests.size).toBe(0);
  });
});

describe("3-4. lock cutoff and no late publishing", () => {
  it("locks exactly 5 minutes before the scheduled start (default), not a second earlier", async () => {
    const s = setup({ minParticipants: 0 });
    const c = await openOver1(s);
    expect(c.status).toBe("published");
    expect(c.locksAt).toBe(iso(T0 - 5 * MIN));
    await runTick(s, T0 - 5 * MIN - 1000);
    expect(c.status).toBe("published");
    await runTick(s, T0 - 5 * MIN);
    expect(c.status).toBe("locked");
    expect(() => s.join(c.id, "u1", {}, T0 - 5 * MIN)).toThrow(); // no entry after the lock
  });
  it("never publishes a contest whose lock time has passed", async () => {
    const s = setup({ requireApproval: true });
    await runTick(s, T0 - 180 * MIN);
    const c = contestFor(s, 1, 1);
    expect(c.status).toBe("draft");
    await runTick(s, T0 - 4 * MIN); // nobody approved it in time
    expect(c.status).toBe("cancelled");
    expect(c.cancelReason).toBe("expired_unpublished");
  });
  it("does not assume the match started just because the clock passed the start time", async () => {
    const s = setup({ minParticipants: 0 });
    const c = await openOver1(s);
    await runTick(s, T0 + 10 * MIN); // provider still says "upcoming"
    expect(c.status).toBe("locked");
    s.matches.set("m1", match({ state: "live" }));
    await runTick(s, T0 + 11 * MIN);
    expect(c.status).toBe("live");
  });
});

describe("5-7. default scoring: +2 / -1 / 0", () => {
  it("pays +2 per correct, -1 per wrong, 0 for unanswered and ignores void questions", async () => {
    const s = setup({ minParticipants: 1 });
    const c = await openOver1(s, ["u1"]);
    const qs = await s.listQuestions(c.id);
    s.join(c.id, "u1", { [qs[0].id]: "four", [qs[1].id]: "dot", [qs[2].id]: "six" /* q3-q5 skipped */ }, T0 - 30 * MIN);
    await runTick(s, T0 - 5 * MIN);
    s.matches.set("m1", match({ state: "live" }));
    s.facts.set("m1", facts());
    s.ingestEvents("m1", [
      ball(1, 1, { runsBat: 4 }),            // q1 correct (four)
      ball(1, 2, { runsBat: 1 }),            // q2 wrong (picked dot)
      ball(1, 3, { runsBat: 0 }),            // q3 wrong (picked six)
      ball(1, 4), ball(1, 5), ball(1, 6),    // unanswered
    ]);
    await runTick(s, T0 + 30 * MIN);
    const e = (await s.listEntries(c.id))[0];
    expect(e.points).toBe(2 - 1 - 1);
    expect(e.correct).toBe(1);
    expect(e.feePaid).toBe(13);
  });
  it("a delivery that was never bowled is void for everyone (0 points, not counted)", () => {
    const rule = { kind: "delivery_outcome", innings: 1, over: 5, slot: 3, mode: "legal" } as const;
    const done = facts({ state: "completed", innings: [{ no: 1, team: "India", runs: 100, wickets: 10, overs: 4.2, complete: true }] });
    expect(resolveQuestion(rule, { facts: done, events: [] })).toEqual({ status: "void", reason: "delivery_not_bowled" });
  });
});

describe("8-9. deliveries in an over; wides and no-balls", () => {
  const rule = (slot: number, mode: "legal" | "event") => ({ kind: "delivery_outcome", innings: 1, over: 1, slot, mode }) as const;
  const over = [
    ball(1, 1, { runsBat: 1 }),
    ball(1, 2, { legal: false, extras: 1, extraType: "wide" }),
    ball(1, 3, { runsBat: 4 }),
    ball(1, 4, { legal: false, extras: 1, extraType: "noball", runsBat: 6 }),
    ball(1, 5, { wicket: true, runsBat: 0 }),
    ball(1, 6), ball(1, 7), ball(1, 8),
  ].map((e) => ({ ...e, matchId: "m1", revision: 1 })) as BallEvent[];
  it("legal mode: the 2nd LEGAL ball is the 3rd delivery (wide skipped)", () => {
    expect(resolveQuestion(rule(2, "legal"), { facts: facts(), events: over })).toEqual({ status: "resolved", optionId: "four" });
    expect(resolveQuestion(rule(3, "legal"), { facts: facts(), events: over })).toEqual({ status: "resolved", optionId: "wicket" });
    expect(resolveQuestion(rule(6, "legal"), { facts: facts(), events: over })).toEqual({ status: "resolved", optionId: "dot" });
  });
  it("event mode: every delivery counts and wides / no-balls are their own outcomes", () => {
    const ids = defaultOptionIds("event");
    const ctx = { facts: facts(), events: over, optionIds: ids };
    expect(resolveQuestion(rule(2, "event"), ctx)).toEqual({ status: "resolved", optionId: "wide" });
    expect(resolveQuestion(rule(4, "event"), ctx)).toEqual({ status: "resolved", optionId: "noball" }); // no-ball beats the 6 off the bat
  });
  it("one primary outcome per delivery: wicket beats runs; an unstated extra type is never guessed", () => {
    const base = { eventKey: "x", matchId: "m1", innings: 1, over: 1, seq: 1, legal: true, extras: 0, revision: 1 };
    expect(classifyDelivery({ ...base, runsBat: 2, wicket: true }, "legal")).toBe("wicket");
    expect(classifyDelivery({ ...base, runsBat: 5, wicket: false }, "legal")).toBe("other");
    expect(classifyDelivery({ ...base, legal: false, runsBat: 0, wicket: false }, "event")).toBe("unknown");
  });
  it("rejects options that cannot be resolved in the chosen mode, and maps switched-off outcomes to Other", () => {
    expect(validateOptionIds(["dot", "wide"], "legal")).toMatch(/cannot be an outcome/);
    expect(validateOptionIds(["dot", "wide"], "event")).toBeNull();
    expect(validateOptionIds(["dot", "dot"], "legal")).toMatch(/unique/);
    expect(mapToOffered("run3", ["dot", "other"])).toEqual({ ok: true, optionId: "other" });
    expect(mapToOffered("run3", ["dot", "four"])).toEqual({ ok: false, reason: "outcome_not_offered" });
  });
  it("a missing earlier record keeps the question pending instead of guessing the numbering", () => {
    const gap = [over[0], over[2]]; // seq 1 and 3, seq 2 missing
    expect(resolveQuestion(rule(2, "legal"), { facts: facts(), events: gap })).toEqual({ status: "pending" });
  });
});

describe("10-11. corrections and settlement retries never double-pay", () => {
  async function settledOver(players: string[]) {
    const s = setup();
    const c = await openOver1(s, players);
    const qs = await s.listQuestions(c.id);
    players.forEach((p, i) => s.join(c.id, p, Object.fromEntries(qs.map((q) => [q.id, i === 0 ? "dot" : "four"])), T0 - 30 * MIN + i));
    await runTick(s, T0 - 5 * MIN);
    s.matches.set("m1", match({ state: "live" }));
    s.facts.set("m1", facts());
    s.ingestEvents("m1", [1, 2, 3, 4, 5, 6].map((n) => ball(1, n)));
    await runTick(s, T0 + 20 * MIN);
    s.matches.set("m1", match({ state: "completed" }));
    s.facts.set("m1", facts({ state: "completed", winner: "A", innings: [{ no: 1, team: "India", runs: 150, wickets: 6, overs: 20, complete: true }] }));
    await runTick(s, T0 + 240 * MIN);
    return { s, c, qs };
  }
  it("settlement retries (extra ticks, admin re-run) leave every balance unchanged", async () => {
    const { s, c } = await settledOver(["u1", "u2", "u3"]);
    expect(c.status).toBe("completed");
    const before = ["u1", "u2", "u3"].map((u) => s.balance(u));
    await runTick(s, T0 + 241 * MIN);
    await runTick(s, T0 + 242 * MIN);
    await rerunContest(s, c.id, "admin-1", T0 + 243 * MIN);
    await rerunContest(s, c.id, "admin-1", T0 + 244 * MIN);
    expect(["u1", "u2", "u3"].map((u) => s.balance(u))).toEqual(before);
    expect(s.settlements).toHaveLength(1);
  });
  it("pool: 3 x 13 = 39; winner gets 70% = 27; the platform bucket keeps the other 12", async () => {
    const { s } = await settledOver(["u1", "u2", "u3"]);
    expect(s.balance("u1")).toBe(100 - 13 + 27); // u1 picked "dot" on all six: 6 x +2
    expect(s.balance("u2")).toBe(87);
    expect(s.balance("u3")).toBe(87);
    expect(s.settlements[0]).toMatchObject({ pool: 39, prizeTotal: 27, platformShare: 12 });
    expect([...s.platformLedger.values()].reduce((t, x) => t + x.amount, 0)).toBe(12);
  });
  it("a provider correction re-scores once, adjusts only the difference and keeps accounting balanced", async () => {
    const { s, c } = await settledOver(["u1", "u2", "u3"]);
    // provider corrects ball 1 to a four: u2 and u3 (picked four) now lead u1
    s.ingestEvents("m1", [{ ...ball(1, 1, { runsBat: 4 }), eventKey: [...s.events.get("m1")!.values()].find((e) => e.seq === 1 && e.over === 1)!.eventKey }]);
    await runTick(s, T0 + 250 * MIN);
    await runTick(s, T0 + 251 * MIN); // repeat: no further change
    const total = ["u1", "u2", "u3"].reduce((t, u) => t + s.balance(u), 0);
    const platform = [...s.platformLedger.values()].reduce((t, x) => t + x.amount, 0);
    expect(total + platform).toBe(300); // nothing created or destroyed: 3 players x 100 seed points
    expect(c.correctionVersion).toBe(1);
    expect(s.settlements.map((x) => x.version)).toEqual([0, 1]);
    // one score row per (entry, question) - never duplicated
    expect(s.scoreRows.size).toBeLessThanOrEqual(18);
  });
});

describe("virtual-points economy", () => {
  it("charges the entry fee once, refuses a second join, and refuses when the balance is too low", async () => {
    const s = setup();
    const c = await openOver1(s, ["u1"]);
    const qs = await s.listQuestions(c.id);
    s.join(c.id, "u1", { [qs[0].id]: "dot" }, T0 - 60 * MIN);
    expect(s.balance("u1")).toBe(87);
    expect(() => s.join(c.id, "u1", { [qs[1].id]: "dot" }, T0 - 59 * MIN)).toThrow(/final/);
    expect(s.balance("u1")).toBe(87);
    fund(s, "poor", 12);
    expect(() => s.join(c.id, "poor", { [qs[0].id]: "dot" }, T0 - 58 * MIN)).toThrow(/Not enough/);
    expect(s.balance("poor")).toBe(12);
  });
  it("fewer than the minimum players: cancelled at lock and every fee refunded", async () => {
    const s = setup();
    const c = await openOver1(s, ["u1"]);
    const qs = await s.listQuestions(c.id);
    s.join(c.id, "u1", { [qs[0].id]: "dot" }, T0 - 60 * MIN);
    const r = await runTick(s, T0 - 5 * MIN);
    expect(c.status).toBe("cancelled");
    expect(c.cancelReason).toBe("min_participants_not_met");
    expect(r.refunded).toBe(13);
    expect(s.balance("u1")).toBe(100);
    await runTick(s, T0 - 4 * MIN); // idempotent
    expect(s.balance("u1")).toBe(100);
  });
  it("private contests need the invite code", async () => {
    const s = new MemoryStore();
    s.clock = () => T0 - 60 * MIN;
    const { contest } = await s.insertContest({
      generationKey: "p:1", templateId: null, categoryId: null, matchId: null, sport: "general", trigger: "pre_match", title: "Friends",
      status: "scheduled", opensAt: iso(T0 - 90 * MIN), locksAt: iso(T0), participantLimit: 4, entryFee: 5, minParticipants: 0, prizeSplit: [70],
      isPrivate: true, inviteCode: "ABCDEF1234", allowEdit: false, scoring: BALL_MARKET_SCORING,
      questions: [{ position: 1, prompt: "Q", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], rule: { kind: "static" }, points: 2, staticCorrect: "a" }],
    });
    await runTick(s, T0 - 60 * MIN);
    fund(s, "u1", 50);
    const q = (await s.listQuestions(contest.id))[0];
    expect(() => s.join(contest.id, "u1", { [q.id]: "a" }, T0 - 60 * MIN)).toThrow(/Invite/);
    expect(s.join(contest.id, "u1", { [q.id]: "a" }, T0 - 60 * MIN, "ABCDEF1234").feePaid).toBe(5);
  });
  it("prize split maths: integer rounding, the remainder always goes to the platform", () => {
    expect(planPool([{ userId: "a", rank: 1, feePaid: 13 }, { userId: "b", rank: 2, feePaid: 13 }, { userId: "c", rank: 3, feePaid: 13 }], [70]))
      .toMatchObject({ pool: 39, prizeTotal: 27, platformShare: 12, payouts: [{ userId: "a", rank: 1, amount: 27 }] });
    const p = planPool([{ userId: "a", rank: 1, feePaid: 7 }, { userId: "b", rank: 2, feePaid: 7 }, { userId: "c", rank: 3, feePaid: 7 }], [50, 30, 10]);
    expect(p.prizeTotal + p.platformShare).toBe(p.pool);
    expect(validatePrizeSplit([60, 50])).toMatch(/more than 100/);
    expect(validatePrizeSplit([70])).toBeNull();
  });
  it("concurrent joins: totals always reconcile (fees = prizes + platform + still-held)", async () => {
    const s = setup();
    const c = await openOver1(s);
    const qs = await s.listQuestions(c.id);
    const users = Array.from({ length: 50 }, (_, i) => `p${i}`);
    users.forEach((u) => fund(s, u, 100));
    await Promise.all(users.map(async (u) => { try { s.join(c.id, u, { [qs[0].id]: "dot" }, T0 - 60 * MIN); } catch { /* none expected */ } }));
    expect((await s.listEntries(c.id)).length).toBe(50);
    const fees = [...s.ledger.values()].filter((x) => x.kind === "entry_fee").reduce((t, x) => t - x.amount, 0);
    expect(fees).toBe(50 * 13);
    users.forEach((u) => expect(s.balance(u)).toBe(87));
  });
});

describe("12-13. postponement, abandonment and unverified data", () => {
  it("postponed before the lock: cancelled, entries refunded, reason recorded", async () => {
    const s = setup();
    const c = await openOver1(s, ["u1", "u2"]);
    const qs = await s.listQuestions(c.id);
    s.join(c.id, "u1", { [qs[0].id]: "dot" }, T0 - 60 * MIN);
    s.matches.set("m1", match({ state: "postponed" }));
    await runTick(s, T0 - 30 * MIN);
    expect(c.status).toBe("cancelled");
    expect(c.cancelReason).toBe("match_postponed");
    expect(s.balance("u1")).toBe(100);
  });
  it("postponed after the lock: voided and refunded", async () => {
    const s = setup({ minParticipants: 1 });
    const c = await openOver1(s, ["u1"]);
    const qs = await s.listQuestions(c.id);
    s.join(c.id, "u1", { [qs[0].id]: "dot" }, T0 - 60 * MIN);
    await runTick(s, T0 - 5 * MIN);
    expect(c.status).toBe("locked");
    s.matches.set("m1", match({ state: "postponed" }));
    await runTick(s, T0 + 30 * MIN);
    expect(c.status).toBe("void");
    expect(s.balance("u1")).toBe(100);
  });
  it("abandoned after the start follows the operator policy", async () => {
    for (const policy of ["refund_all", "settle_verified"] as const) {
      const s = setup({ minParticipants: 1 });
      s.controls = { ...s.controls, abandonPolicy: policy };
      const c = await openOver1(s, ["u1"]);
      const qs = await s.listQuestions(c.id);
      s.join(c.id, "u1", { [qs[0].id]: "dot" }, T0 - 60 * MIN);
      await runTick(s, T0 - 5 * MIN);
      s.matches.set("m1", match({ state: "abandoned" }));
      s.facts.set("m1", facts({ state: "abandoned", statusText: "Match abandoned" }));
      await runTick(s, T0 + 30 * MIN);
      await runTick(s, T0 + 31 * MIN);
      expect(c.status).toBe("void"); // nothing was verified, so both policies end in void + refund
      expect(s.balance("u1")).toBe(100);
    }
  });
  it("a rescheduled match replaces contests built for the old start time", async () => {
    const s = setup();
    const c = await openOver1(s, ["u1"]);
    const qs = await s.listQuestions(c.id);
    s.join(c.id, "u1", { [qs[0].id]: "dot" }, T0 - 60 * MIN);
    const newStart = T0 + 24 * 60 * MIN;
    s.matches.set("m1", match({ startsAt: iso(newStart) }));
    await runTick(s, T0 - 30 * MIN);
    expect(c.status).toBe("cancelled");
    expect(c.cancelReason).toBe("match_rescheduled");
    expect(s.balance("u1")).toBe(100);
    await runTick(s, newStart - 180 * MIN);
    expect([...s.contests.values()].filter((x) => x.status === "scheduled" || x.status === "published").length).toBe(40);
  });
  it("missing or stale provider data never settles anything", async () => {
    const s = setup();
    const c = await openOver1(s, ["u1", "u2"]);
    const qs = await s.listQuestions(c.id);
    s.join(c.id, "u1", { [qs[0].id]: "dot" }, T0 - 60 * MIN);
    s.join(c.id, "u2", { [qs[0].id]: "four" }, T0 - 59 * MIN);
    await runTick(s, T0 - 5 * MIN);
    s.matches.set("m1", match({ state: "live" }));
    // facts unavailable (stale) and no events: everything stays pending
    await runTick(s, T0 + 60 * MIN);
    await runTick(s, T0 + 61 * MIN);
    expect(["locked", "live"]).toContain(c.status);
    expect(s.settlements).toHaveLength(0);
    expect(s.balance("u1")).toBe(87);
    expect((await s.listQuestions(c.id)).every((q) => q.status === "open")).toBe(true);
  });
});

describe("14-15. admin control", () => {
  it("every admin server function requires the settings.manage permission", () => {
    const src = readFileSync(new URL("../admin-pred.functions.ts", import.meta.url), "utf8");
    const defs = src.split(/export const \w+ = createServerFn/).slice(1);
    expect(defs.length).toBeGreaterThan(15);
    for (const d of defs) expect(d.slice(0, 200)).toContain("requireAdminPermission(PERM)");
    expect(src).toContain('const PERM = "settings.manage"');
  });
  it("manual cancellations, exclusions and pauses are respected by the scheduler", async () => {
    const s = setup();
    await runTick(s, T0 - 180 * MIN);
    const c = contestFor(s, 1, 1);
    await cancelContest(s, c.id, "admin-1", "Testing manual cancel");
    expect(c.status).toBe("cancelled");
    await runTick(s, T0 - 170 * MIN);
    expect(c.status).toBe("cancelled"); // not revived
    expect(s.contests.size).toBe(40); // not recreated either

    const paused = setup();
    paused.controls = { ...paused.controls, pauseGeneration: true };
    expect((await runTick(paused, T0 - 180 * MIN)).skipped.generation_paused).toBe(1);
    expect(paused.contests.size).toBe(0);

    const excluded = setup();
    excluded.controls = { ...excluded.controls, excludedMatchIds: ["m1"] };
    await runTick(excluded, T0 - 180 * MIN);
    expect(excluded.contests.size).toBe(0);

    const sportOff = setup();
    sportOff.controls = { ...sportOff.controls, disabledSports: ["cricket"] };
    await runTick(sportOff, T0 - 180 * MIN);
    expect(sportOff.contests.size).toBe(0);

    const seriesOff = new MemoryStore();
    seriesOff.matches.set("m1", match({ series: "Some League" }));
    seriesOff.templates = [ballTemplate()];
    seriesOff.controls = { ...seriesOff.controls, disabledSeries: ["Some League"] };
    await runTick(seriesOff, T0 - 180 * MIN);
    expect(seriesOff.contests.size).toBe(0);
  });
  it("publication and settlement pauses hold their own stage only", async () => {
    const s = setup();
    s.controls = { ...s.controls, pausePublication: true };
    await runTick(s, T0 - 180 * MIN);
    await runTick(s, T0 - 100 * MIN);
    expect(contestFor(s, 1, 1).status).toBe("scheduled"); // generated, not published
    s.controls = { ...s.controls, pausePublication: false };
    await runTick(s, T0 - 99 * MIN);
    expect(contestFor(s, 1, 1).status).toBe("published");
  });
  it("manual generation can create contests early, once, and is idempotent", async () => {
    const s = setup({ autoGenerate: false });
    const r1 = emptyReport();
    await generateContests(s, [match()], T0 - 600 * MIN, r1, { force: true, matchIds: ["m1"] });
    expect(r1.generated).toBe(40);
    const r2 = emptyReport();
    await generateContests(s, [match()], T0 - 599 * MIN, r2, { force: true, matchIds: ["m1"] });
    expect(r2.generated).toBe(0);
    const auto = await runTick(setup({ autoGenerate: false }), T0 - 180 * MIN);
    expect(auto.generated).toBe(0); // manual-only templates are never auto-generated
  });
});

describe("18. recovery after a worker restart", () => {
  it("a crash between 'cancelled' and the refunds is finished by the next run, exactly once", async () => {
    const s = setup();
    const c = await openOver1(s, ["u1", "u2"]);
    const qs = await s.listQuestions(c.id);
    s.join(c.id, "u1", { [qs[0].id]: "dot" }, T0 - 60 * MIN);
    s.join(c.id, "u2", { [qs[0].id]: "four" }, T0 - 59 * MIN);
    s.matches.set("m1", match({ state: "cancelled" }));
    // first run: the worker dies while crediting the second refund
    const original = s.credit.bind(s);
    let calls = 0;
    s.credit = async (i) => { if (i.kind === "refund" && ++calls >= 2) throw new Error("worker killed"); return original(i); };
    const first = await runTick(s, T0 - 30 * MIN);
    expect(first.errors.join()).toContain("worker killed");
    expect(c.status).toBe("cancelled");
    expect(c.refundedAt ?? null).toBeNull();
    s.credit = original; // restarted worker
    await runTick(s, T0 - 29 * MIN);
    await runTick(s, T0 - 28 * MIN);
    expect(s.balance("u1")).toBe(100);
    expect(s.balance("u2")).toBe(100);
    expect(c.refundedAt).toBeTruthy();
  });
});

describe("score-only contests (no ball-by-ball data needed)", () => {
  const pack = (over: Partial<ContestTemplate> = {}) => ballTemplate({ id: "t-pack", name: "Score pack", plan: { generator: "score_pack" }, minParticipants: 0, ...over });
  const done = (r1: number, w1: number, r2: number, w2: number, winner: "A" | "B") => facts({
    state: "completed", winner, statusText: `${winner === "A" ? "India" : "Australia"} won`,
    innings: [
      { no: 1, team: "India", runs: r1, wickets: w1, overs: 20, complete: true },
      { no: 2, team: "Australia", runs: r2, wickets: w2, overs: 20, complete: true },
    ],
  });
  it("creates one six-question pack 3 hours before the match, once", async () => {
    const s = new MemoryStore(); s.matches.set("m1", match()); s.templates = [pack()];
    expect((await runTick(s, T0 - 180 * MIN)).generated).toBe(1);
    expect((await runTick(s, T0 - 170 * MIN)).generated).toBe(0);
    const c = [...s.contests.values()][0];
    expect(c.locksAt).toBe(iso(T0 - 5 * MIN));
    expect(await s.listQuestions(c.id)).toHaveLength(6);
  });
  it("settles every question from the final score alone and pays +2 / -1", async () => {
    const s = new MemoryStore(); s.matches.set("m1", match()); s.templates = [pack()];
    await runTick(s, T0 - 180 * MIN); await runTick(s, T0 - 179 * MIN);
    const c = [...s.contests.values()][0]; const qs = await s.listQuestions(c.id);
    fund(s, "u1", 100); fund(s, "u2", 100);
    // match: India 182/6, Australia 160/10 -> winner a, inn1 b2 (170-199), inn2 b1 (140-169), wkts 6 -> b1 (4-6), 10 -> b3, total 342 -> b2 (340-389)
    s.join(c.id, "u1", { [qs[0].id]: "a", [qs[1].id]: "b2", [qs[2].id]: "b1", [qs[3].id]: "b1", [qs[4].id]: "b3", [qs[5].id]: "b2" }, T0 - 60 * MIN);
    s.join(c.id, "u2", { [qs[0].id]: "b", [qs[1].id]: "b0" }, T0 - 59 * MIN);
    await runTick(s, T0 - 5 * MIN);
    s.matches.set("m1", match({ state: "completed" }));
    s.facts.set("m1", done(182, 6, 160, 10, "A"));
    await runTick(s, T0 + 300 * MIN);
    const e = Object.fromEntries((await s.listEntries(c.id)).map((x) => [x.userId, x]));
    expect(e.u1.points).toBe(12); // six correct
    expect(e.u2.points).toBe(-2); // two wrong, four unanswered
    expect(c.status).toBe("completed");
    expect(s.balance("u1")).toBe(100 - 13 + 18); // pool 26 -> 70% = 18
    expect(s.balance("u2")).toBe(87);
  });
  it("stays unsettled while the score is still live or unverified", async () => {
    const s = new MemoryStore(); s.matches.set("m1", match({ state: "live" })); s.templates = [pack()];
    s.facts.set("m1", facts({ innings: [{ no: 1, team: "India", runs: 90, wickets: 2, overs: 10, complete: false }] }));
    const rule = { kind: "match_total" as const, thresholds: [290, 340, 390] };
    expect(resolveQuestion(rule, { facts: s.facts.get("m1")!, events: [] })).toEqual({ status: "pending" });
    expect(resolveQuestion({ kind: "innings_wickets", innings: 1, thresholds: [4, 7, 10] }, { facts: s.facts.get("m1")!, events: [] })).toEqual({ status: "pending" });
    expect(resolveQuestion(rule, { facts: null, events: [] })).toEqual({ status: "pending" });
  });
});
