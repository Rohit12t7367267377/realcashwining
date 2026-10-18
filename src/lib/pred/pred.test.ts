import { describe, expect, it } from "vitest";
import { MemoryStore } from "./memory-store";
import { approveContest, correctQuestion, runTick as engineTick } from "./engine";
import { bucketIndex, bucketOptions, FOUR_BALL_OPTIONS, generateForTemplate, maxOvers, validateQuestions } from "./generate";
import { classifyBall, resolveQuestion } from "./outcomes";
import { applyDailyCap, desiredRewards } from "./rewards";
import { rankEntries, scoreEntry } from "./scoring";
import { detectMilestone, planMilestoneWindow, planPreMatchWindow, validateTiming } from "./timing";
import {
  DEFAULT_SCORING,
  DEFAULT_TIMING,
  type BallEvent,
  type ContestTemplate,
  type MatchFacts,
  type MatchRef,
  type PlannedQuestion,
} from "./types";

const MIN = 60_000;
/** Runs one scheduler pass with the store clock pinned to the simulated time. */
const runTick = (s: MemoryStore, ms: number) => { s.clock = () => ms; return engineTick(s, ms); };
const T0 = Date.parse("2026-10-20T11:00:00.000Z"); // match start
const iso = (ms: number) => new Date(ms).toISOString();

const match = (over: Partial<MatchRef> = {}): MatchRef => ({
  id: "m1", sport: "cricket", format: "T20", startsAt: iso(T0), state: "upcoming", teamA: "India", teamB: "Australia", statusText: "Match not started", ...over,
});
const template = (over: Partial<ContestTemplate> = {}): ContestTemplate => ({
  id: "t-over1", categoryId: null, name: "First over", sport: "cricket", formats: ["t20"],
  plan: { generator: "over_by_over", innings: 1, over: 1, balls: 6 }, timing: { ...DEFAULT_TIMING },
  scoring: { ...DEFAULT_SCORING }, participantLimit: null, entryFee: 0, minParticipants: 0, prizeSplit: [70], autoGenerate: true, requireApproval: false, allowEdit: false, enabled: true, ...over,
});
const facts = (over: Partial<MatchFacts> = {}): MatchFacts => ({
  matchId: "m1", state: "live", statusText: "Live", teamA: "India", teamB: "Australia", winner: null, innings: [], verifiedAt: iso(T0), ...over,
});
let evSeq = 0;
const ball = (over: number, seq: number, o: Partial<BallEvent> = {}): Omit<BallEvent, "revision" | "matchId"> => ({
  eventKey: `e${++evSeq}-${over}.${seq}`, innings: 1, over, seq, legal: true, runsBat: 0, extras: 0, wicket: false, ...o,
});

function setup(opts: { tpl?: Partial<ContestTemplate>; match?: Partial<MatchRef> } = {}) {
  const s = new MemoryStore();
  s.matches.set("m1", match(opts.match));
  s.templates = [template(opts.tpl)];
  return s;
}

// ---------------------------------------------------------------------------
describe("timing", () => {
  it("creates 60 min before, opens 30 min before, locks 1 min before", () => {
    const p = planPreMatchWindow(DEFAULT_TIMING, iso(T0), T0 - 60 * MIN);
    expect(p).toMatchObject({ create: true, opensAt: iso(T0 - 30 * MIN), locksAt: iso(T0 - 1 * MIN), caughtUp: false });
  });
  it("waits before the creation window and never creates after the match starts", () => {
    expect(planPreMatchWindow(DEFAULT_TIMING, iso(T0), T0 - 61 * MIN)).toEqual({ create: false, reason: "too_early" });
    expect(planPreMatchWindow(DEFAULT_TIMING, iso(T0), T0 + MIN)).toEqual({ create: false, reason: "match_started" });
  });
  it("catch-up: shortens when discovered late, skips when policy is skip, refuses expired windows", () => {
    expect(planPreMatchWindow(DEFAULT_TIMING, iso(T0), T0 - 20 * MIN)).toMatchObject({ create: true, caughtUp: true, opensAt: iso(T0 - 20 * MIN) });
    expect(planPreMatchWindow({ ...DEFAULT_TIMING, catchUp: "skip" }, iso(T0), T0 - 20 * MIN)).toEqual({ create: false, reason: "late_discovery" });
    expect(planPreMatchWindow(DEFAULT_TIMING, iso(T0), T0 - 3 * MIN)).toEqual({ create: false, reason: "expired" });
    expect(planPreMatchWindow(DEFAULT_TIMING, iso(T0), T0 - 1 * MIN)).toEqual({ create: false, reason: "expired" });
  });
  it("the 30-minute window is configurable", () => {
    const t = { ...DEFAULT_TIMING, createBeforeMin: 120, opensBeforeMin: 90 };
    expect(planPreMatchWindow(t, iso(T0), T0 - 100 * MIN)).toMatchObject({ create: true, opensAt: iso(T0 - 90 * MIN), caughtUp: false });
    expect(planPreMatchWindow(t, iso(T0), T0 - 80 * MIN)).toMatchObject({ create: true, opensAt: iso(T0 - 80 * MIN), caughtUp: true });
  });
  it("rejects inconsistent timing", () => {
    expect(validateTiming({ ...DEFAULT_TIMING, opensBeforeMin: 5, locksBeforeMin: 10 })).toBeTruthy();
    expect(validateTiming({ ...DEFAULT_TIMING, createBeforeMin: 10, opensBeforeMin: 30 })).toBeTruthy();
    expect(planPreMatchWindow({ ...DEFAULT_TIMING, locksBeforeMin: 40 }, iso(T0), T0 - 60 * MIN)).toEqual({ create: false, reason: "invalid_timing" });
    expect(planMilestoneWindow({ ...DEFAULT_TIMING, trigger: "innings_break", lockAfterMin: 5 }, T0)).toMatchObject({ create: true, locksAt: iso(T0 + 5 * MIN) });
  });
  it("detects innings break and after-over milestones only when still in the future", () => {
    const innDone = facts({ innings: [{ no: 1, team: "India", runs: 180, wickets: 6, overs: 20, complete: true }] });
    expect(detectMilestone({ ...DEFAULT_TIMING, trigger: "innings_break", innings: 1 }, match({ state: "live" }), innDone, [])?.key).toBe("inn1");
    const started = facts({ innings: [...innDone.innings, { no: 2, team: "Australia", runs: 4, wickets: 0, overs: 0.5, complete: false }] });
    expect(detectMilestone({ ...DEFAULT_TIMING, trigger: "innings_break", innings: 1 }, match({ state: "live" }), started, [])).toBeNull();
    const six = [1, 2, 3, 4, 5, 6].map((n) => ({ ...ball(1, n), matchId: "m1", revision: 1 }));
    const t = { ...DEFAULT_TIMING, trigger: "after_over" as const, afterOver: 1, innings: 1 };
    expect(detectMilestone(t, match({ state: "live" }), facts(), six)?.over).toBe(1);
    expect(detectMilestone(t, match({ state: "live" }), facts(), [...six, { ...ball(2, 1), matchId: "m1", revision: 1 }])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("generation", () => {
  it("builds six over-by-over questions for a T20", () => {
    const g = generateForTemplate(match(), template());
    expect(g.ok).toBe(true);
    if (g.ok) {
      expect(g.questions).toHaveLength(6);
      expect(g.questions[0].rule).toEqual({ kind: "ball_outcome", innings: 1, over: 1, ball: 1 });
      expect(g.questions.map((q) => q.position)).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });
  it("never produces invalid or unsupported contests", () => {
    expect(generateForTemplate(match({ format: "Test" }), template())).toEqual({ ok: false, reason: "format_not_supported" });
    expect(generateForTemplate(match({ format: "T20" }), template({ plan: { generator: "over_by_over", over: 21 } }))).toEqual({ ok: false, reason: "over_out_of_range" });
    expect(generateForTemplate(match({ format: "Test" }), template({ plan: { generator: "innings_total" } }))).toEqual({ ok: false, reason: "thresholds_required" });
    const bad: PlannedQuestion = { position: 1, prompt: "Q?", options: [{ id: "a", label: "x" }], rule: { kind: "manual" }, points: 10 };
    expect(validateQuestions([bad])).toBeTruthy();
    expect(validateQuestions([{ ...bad, prompt: "Pick one", options: [{ id: "a", label: "x" }, { id: "b", label: "X" }] }])).toBeTruthy();
  });
  it("match winner adds Draw only for Tests; innings total buckets are sound", () => {
    const g = generateForTemplate(match({ format: "Test" }), template({ plan: { generator: "match_winner" } }));
    expect(g.ok && g.questions[0].options.map((o) => o.id)).toEqual(["a", "b", "draw"]);
    expect(maxOvers("ODI")).toBe(50);
    expect(bucketOptions([140, 170, 200]).map((o) => o.label)).toEqual(["Under 140", "140–169", "170–199", "200 or more"]);
    expect([139, 140, 169, 170, 200].map((n) => bucketIndex(n, [140, 170, 200]))).toEqual([0, 1, 1, 2, 3]);
  });
  it("static (trivia / custom) questions keep their answer out of the question", () => {
    const g = generateForTemplate(match(), template({ plan: { generator: "static", questions: [{ prompt: "Capital of India?", options: ["Delhi", "Mumbai"], correctIndex: 0 }] } }));
    expect(g.ok && g.questions[0].staticCorrect).toBe("o1");
  });
});

// ---------------------------------------------------------------------------
describe("settlement rules", () => {
  const ev = (list: Array<Omit<BallEvent, "revision" | "matchId">>): BallEvent[] => list.map((e) => ({ ...e, matchId: "m1", revision: 1 }));
  it("classifies deliveries", () => {
    const b = (o: Partial<BallEvent>) => classifyBall({ ...ball(1, 1), matchId: "m1", revision: 1, ...o });
    expect([b({}), b({ runsBat: 2 }), b({ runsBat: 4 }), b({ runsBat: 6 }), b({ wicket: true, runsBat: 1 }), b({ runsBat: 0, extras: 1 })]).toEqual(["dot", "run", "four", "six", "wicket", "dot"]);
  });
  it("wides and no-balls are not legal deliveries", () => {
    const events = ev([ball(1, 1, { legal: false, extras: 1 }), ball(1, 2, { runsBat: 4 }), ball(1, 3, { runsBat: 0 })]);
    const rule = (n: number) => ({ kind: "ball_outcome" as const, innings: 1, over: 1, ball: n });
    expect(resolveQuestion(rule(1), { facts: facts(), events })).toEqual({ status: "resolved", optionId: "four" });
    expect(resolveQuestion(rule(2), { facts: facts(), events })).toEqual({ status: "resolved", optionId: "dot" });
    expect(resolveQuestion(rule(3), { facts: facts(), events })).toEqual({ status: "pending" });
  });
  it("stays pending when an earlier record is missing instead of guessing", () => {
    const events = ev([ball(1, 2, { runsBat: 6 })]); // seq 1 never arrived
    expect(resolveQuestion({ kind: "ball_outcome", innings: 1, over: 1, ball: 1 }, { facts: facts(), events })).toEqual({ status: "pending" });
  });
  it("voids deliveries that never happened and everything in an abandoned match", () => {
    const done = facts({ innings: [{ no: 1, team: "India", runs: 10, wickets: 10, overs: 0.2, complete: true }] });
    expect(resolveQuestion({ kind: "ball_outcome", innings: 1, over: 1, ball: 5 }, { facts: done, events: ev([ball(1, 1)]) })).toEqual({ status: "void", reason: "delivery_not_bowled" });
    expect(resolveQuestion({ kind: "match_winner" }, { facts: facts({ state: "abandoned" }), events: [] })).toEqual({ status: "void", reason: "match_no_result" });
  });
  it("match winner, tie handling and innings totals", () => {
    expect(resolveQuestion({ kind: "match_winner" }, { facts: facts({ winner: "B" }), events: [] })).toEqual({ status: "resolved", optionId: "b" });
    expect(resolveQuestion({ kind: "match_winner" }, { facts: facts({ winner: "tie" }), events: [] })).toEqual({ status: "void", reason: "tie_no_option" });
    expect(resolveQuestion({ kind: "match_winner" }, { facts: facts({ winner: "tie" }), events: [], hasDrawOption: true })).toEqual({ status: "resolved", optionId: "draw" });
    const f = facts({ innings: [{ no: 1, team: "India", runs: 172, wickets: 5, overs: 20, complete: true }] });
    expect(resolveQuestion({ kind: "innings_total", innings: 1, thresholds: [140, 170, 200] }, { facts: f, events: [] })).toEqual({ status: "resolved", optionId: "b2" });
    expect(resolveQuestion({ kind: "innings_total", innings: 2, thresholds: [140, 170, 200] }, { facts: f, events: [] })).toEqual({ status: "pending" });
  });
});

// ---------------------------------------------------------------------------
describe("ranking and rewards", () => {
  it("ranks deterministically: points, correct, earlier submit, user id", () => {
    const r = rankEntries([
      { userId: "d", entryId: "4", points: 20, correct: 2, submittedAt: iso(T0) },
      { userId: "b", entryId: "2", points: 30, correct: 3, submittedAt: iso(T0 + 5) },
      { userId: "a", entryId: "1", points: 30, correct: 3, submittedAt: iso(T0 + 5) },
      { userId: "c", entryId: "3", points: 30, correct: 4, submittedAt: iso(T0 + 9) },
    ]);
    expect(r.map((x) => x.userId)).toEqual(["c", "a", "b", "d"]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3, 4]);
  });
  it("rewards: participation + per-correct + rank bonus, capped, none when cancelled", () => {
    const rules = { participation: 5, perCorrect: 2, rankBonus: [50, 30], maxPerContest: 60, dailyCap: 100 };
    const ranked = [{ userId: "u1", entryId: "e1", points: 60, correct: 6, submittedAt: "", rank: 1, answered: 6 }, { userId: "u2", entryId: "e2", points: 0, correct: 0, submittedAt: "", rank: 2, answered: 6 }];
    expect(desiredRewards(ranked, rules).map((d) => d.total)).toEqual([60, 5]);
    expect(desiredRewards(ranked, rules, true).map((d) => d.total)).toEqual([0, 0]);
    expect(applyDailyCap(30, 90, 100)).toBe(10);
    expect(applyDailyCap(-30, 90, 100)).toBe(-30);
  });
});

// ---------------------------------------------------------------------------
describe("engine", () => {
  it("generates exactly one contest even when the job retries many times", async () => {
    const s = setup();
    for (let i = 0; i < 5; i++) await runTick(s, T0 - 59 * MIN);
    expect(s.contests.size).toBe(1);
    expect([...s.contests.values()][0].status).toBe("scheduled");
  });
  it("does nothing before the creation window, for cancelled matches, or wrong sport/format", async () => {
    const early = setup(); await runTick(early, T0 - 3 * 60 * MIN); expect(early.contests.size).toBe(0);
    const cancelled = setup({ match: { state: "cancelled" } }); await runTick(cancelled, T0 - 59 * MIN); expect(cancelled.contests.size).toBe(0);
    const wrongFormat = setup({ match: { format: "ODI" } }); await runTick(wrongFormat, T0 - 59 * MIN); expect(wrongFormat.contests.size).toBe(0);
    const disabled = setup({ tpl: { enabled: false } }); await runTick(disabled, T0 - 59 * MIN); expect(disabled.contests.size).toBe(0);
  });
  it("late discovery uses catch-up rules and never creates expired contests", async () => {
    const late = setup(); const r = await runTick(late, T0 - 15 * MIN);
    expect(r.generated).toBe(1);
    expect([...late.contests.values()][0].opensAt).toBe(iso(T0 - 15 * MIN));
    const tooLate = setup(); const r2 = await runTick(tooLate, T0 - 3 * MIN);
    expect(r2.generated).toBe(0); expect(r2.skipped.expired).toBe(1);
  });
  it("approval flow: drafts stay hidden until an admin approves", async () => {
    const s = setup({ tpl: { requireApproval: true } });
    await runTick(s, T0 - 40 * MIN); await runTick(s, T0 - 25 * MIN);
    const c = [...s.contests.values()][0];
    expect(c.status).toBe("draft");
    expect(await approveContest(s, c.id, "admin-1")).toBe(true);
    await runTick(s, T0 - 24 * MIN);
    expect(c.status).toBe("published");
  });
  it("cancels unstarted contests when the match is postponed or cancelled", async () => {
    const s = setup(); await runTick(s, T0 - 59 * MIN);
    s.matches.set("m1", match({ state: "postponed" }));
    const r = await runTick(s, T0 - 58 * MIN);
    expect(r.cancelled).toBe(1);
    expect([...s.contests.values()][0].status).toBe("cancelled");
    s.matches.set("m1", match({ state: "upcoming", startsAt: iso(T0 + 24 * 60 * MIN) })); // rescheduled
    const r2 = await runTick(s, T0 + 24 * 60 * MIN - 59 * MIN);
    expect(r2.generated).toBe(1); // a fresh contest for the new start time
  });
  it("answers lock at the right time and are final", async () => {
    const s = setup(); await runTick(s, T0 - 59 * MIN); await runTick(s, T0 - 29 * MIN);
    const c = [...s.contests.values()][0];
    const qs = await s.listQuestions(c.id);
    expect(() => s.join(c.id, "u1", { [qs[0].id]: "dot" }, T0 - 20 * MIN)).not.toThrow();
    expect(() => s.join(c.id, "u1", { [qs[0].id]: "six" }, T0 - 19 * MIN)).toThrow(/final/);
    expect(() => s.join(c.id, "u2", { [qs[0].id]: "nope" }, T0 - 19 * MIN)).toThrow(/Invalid/);
    await runTick(s, T0 - 30_000);
    expect(c.status).toBe("locked");
    expect(() => s.join(c.id, "u3", { [qs[0].id]: "dot" }, T0 - 30_000)).toThrow(/not open/);
  });
  it("enforces participant limits", async () => {
    const s = setup({ tpl: { participantLimit: 1 } }); await runTick(s, T0 - 59 * MIN); await runTick(s, T0 - 29 * MIN);
    const c = [...s.contests.values()][0]; const qs = await s.listQuestions(c.id);
    s.join(c.id, "u1", { [qs[0].id]: "dot" }, T0 - 20 * MIN);
    expect(() => s.join(c.id, "u2", { [qs[0].id]: "dot" }, T0 - 20 * MIN)).toThrow(/full/);
  });
});

// ---------------------------------------------------------------------------
describe("full match simulation", () => {
  it("discovery -> contest -> picks -> live events -> verified result -> ranks -> rewards -> notices, with a correction", async () => {
    const s = setup();
    s.rewardRules = { participation: 5, perCorrect: 2, rankBonus: [50, 30, 20], maxPerContest: 500, dailyCap: 1000 };

    // 1. discovery & generation (T-60), publish (T-30)
    expect((await runTick(s, T0 - 60 * MIN)).generated).toBe(1);
    expect((await runTick(s, T0 - 30 * MIN)).published).toBe(1);
    const c = [...s.contests.values()][0];
    const qs = await s.listQuestions(c.id);

    // 2. three players pick: alice right on 1-5 (guessed six on 5), bob right on 1-2 and 4, cara only 4
    const truth = ["dot", "four", "run", "wicket", "six", "dot"];
    s.join(c.id, "alice", Object.fromEntries(qs.map((q, i) => [q.id, i < 4 ? truth[i] : "six"])), T0 - 20 * MIN);
    s.join(c.id, "bob", Object.fromEntries(qs.map((q, i) => [q.id, i < 2 ? truth[i] : "wicket"])), T0 - 15 * MIN);
    s.join(c.id, "cara", Object.fromEntries(qs.map((q) => [q.id, "wicket"])), T0 - 10 * MIN);
    expect((await runTick(s, T0 - 10 * MIN)).notices).toBeGreaterThan(0); // deadline reminder

    // 3. lock at T-1
    expect((await runTick(s, T0 - 30_000)).locked).toBe(1);

    // 4. match goes live; provider feeds balls (a wide first, then the six legal deliveries)
    s.matches.set("m1", match({ state: "live" }));
    s.facts.set("m1", facts());
    const over1 = [
      ball(1, 1, { legal: false, extras: 1 }),
      ball(1, 2, { runsBat: 0 }), ball(1, 3, { runsBat: 4 }), ball(1, 4, { runsBat: 1 }),
      ball(1, 5, { wicket: true }), ball(1, 6, { runsBat: 6 }), ball(1, 7, { runsBat: 0 }),
    ];
    s.ingestEvents("m1", over1.slice(0, 3));
    let r = await runTick(s, T0 + 2 * MIN);
    expect(r.resolved).toBe(2); // legal deliveries 1 and 2 verified so far
    expect(c.status).toBe("settling");
    expect(s.balance("alice")).toBe(0); // no rewards before the contest is verified complete

    // duplicate delivery of the same events changes nothing
    s.ingestEvents("m1", over1.slice(0, 3));
    r = await runTick(s, T0 + 2 * MIN + 10_000);
    expect(r.resolved).toBe(0);

    s.ingestEvents("m1", over1);
    r = await runTick(s, T0 + 4 * MIN);
    expect(r.resolved).toBe(4);
    expect(c.status).toBe("settling"); // all questions closed but match not final yet

    // 5. match ends
    s.matches.set("m1", match({ state: "completed" }));
    s.facts.set("m1", facts({ state: "completed", winner: "A", innings: [{ no: 1, team: "India", runs: 180, wickets: 6, overs: 20, complete: true }] }));
    r = await runTick(s, T0 + 3 * 60 * MIN);
    expect(r.completed).toBe(1);
    expect(c.status).toBe("completed");

    // 6. verified scoring + ranks + rewards
    const entries = await s.listEntries(c.id);
    const byUser = Object.fromEntries(entries.map((e) => [e.userId, e]));
    expect([byUser.alice.points, byUser.bob.points, byUser.cara.points]).toEqual([50, 30, 10]);
    expect([byUser.alice.correct, byUser.bob.correct, byUser.cara.correct]).toEqual([5, 3, 1]);
    expect(s.balance("alice")).toBe(5 + 5 * 2 + 50);
    expect(s.balance("bob")).toBe(5 + 3 * 2 + 30);
    expect(s.balance("cara")).toBe(5 + 1 * 2 + 20);

    // 7. repeating the job never double pays or double notifies
    const before = { a: s.balance("alice"), n: s.notices.size, l: s.ledger.size };
    for (let i = 0; i < 4; i++) await runTick(s, T0 + 3 * 60 * MIN + i * MIN);
    expect({ a: s.balance("alice"), n: s.notices.size, l: s.ledger.size }).toEqual(before);
    expect([...s.notices.values()].some((n) => n.userId === "alice" && n.kind === "result")).toBe(true);

    // 8. the provider corrects ball 3 (a "run" becomes a "four"): logged, re-scored, rewards adjusted once
    s.ingestEvents("m1", [{ ...over1[3], runsBat: 4 }].map((e) => ({ ...e, eventKey: over1[3].eventKey })));
    r = await runTick(s, T0 + 4 * 60 * MIN);
    expect(r.corrections).toBe(1);
    expect(s.corrections).toHaveLength(1);
    expect(s.corrections[0]).toMatchObject({ actor: "system", reason: "provider_correction" });
    expect(c.correctionVersion).toBe(1);
    const after = Object.fromEntries((await s.listEntries(c.id)).map((e) => [e.userId, e]));
    expect(after.alice.correct).toBe(4); // alice had picked "run" for ball 3, which is no longer right
    expect(s.balance("alice")).toBe(5 + 4 * 2 + 50);
    const settled = { a: s.balance("alice"), l: s.ledger.size };
    await runTick(s, T0 + 4 * 60 * MIN + MIN);
    expect({ a: s.balance("alice"), l: s.ledger.size }).toEqual(settled);

    // 9. an administrator correction needs a reason and is audited
    await expect(correctQuestion(s, c.id, qs[0].id, { status: "resolved", optionId: "six" }, "admin-1", "x", T0)).rejects.toThrow(/reason/);
    await correctQuestion(s, c.id, qs[0].id, { status: "resolved", optionId: "six" }, "admin-1", "Scorer verified a six", T0 + 5 * 60 * MIN);
    expect(s.auditLog.some((a) => a.action === "question.corrected" && a.actor === "admin-1")).toBe(true);
  });

  it("an abandoned match voids the contest and pays nothing", async () => {
    const s = setup(); await runTick(s, T0 - 59 * MIN); await runTick(s, T0 - 29 * MIN);
    const c = [...s.contests.values()][0]; const qs = await s.listQuestions(c.id);
    s.join(c.id, "u1", { [qs[0].id]: "dot" }, T0 - 20 * MIN);
    await runTick(s, T0 - 30_000);
    s.matches.set("m1", match({ state: "abandoned" })); s.facts.set("m1", facts({ state: "abandoned", statusText: "Match abandoned" }));
    const r = await runTick(s, T0 + 30 * MIN);
    expect(c.status).toBe("void");
    expect(r.voided).toBe(1);
    expect(s.balance("u1")).toBe(0);
  });

  it("trivia contests settle on lock without any match", async () => {
    const s = new MemoryStore();
    const { contest } = await s.insertContest({
      generationKey: "custom:1", templateId: null, categoryId: null, matchId: null, sport: "general", trigger: "pre_match", title: "GK",
      status: "scheduled", opensAt: iso(T0), locksAt: iso(T0 + 10 * MIN), participantLimit: null, entryFee: 0, minParticipants: 0, prizeSplit: [70], allowEdit: false, scoring: DEFAULT_SCORING,
      questions: [{ position: 1, prompt: "Capital of India?", options: [{ id: "o1", label: "Delhi" }, { id: "o2", label: "Mumbai" }], rule: { kind: "static" }, points: 10, staticCorrect: "o1" }],
    });
    await runTick(s, T0 + MIN);
    const q = (await s.listQuestions(contest.id))[0];
    s.join(contest.id, "u1", { [q.id]: "o1" }, T0 + 2 * MIN);
    s.join(contest.id, "u2", { [q.id]: "o2" }, T0 + 3 * MIN);
    await runTick(s, T0 + 11 * MIN);
    expect(contest.status).toBe("completed");
    expect(s.balance("u1")).toBeGreaterThan(s.balance("u2"));
  });
});

// ---------------------------------------------------------------------------
describe("every-ball contests (20 overs x 6 balls, 4 options, +5 / -1)", () => {
  const everyBall = (over: Partial<ContestTemplate> = {}) =>
    template({ name: "Every ball", plan: { generator: "innings_balls", innings: 1 }, scoring: { pointsPerCorrect: 5, negativePerWrong: 1 }, ...over });

  it("builds 120 questions for a T20 with exactly four options each", () => {
    const g = generateForTemplate(match(), everyBall());
    if (!g.ok) throw new Error(g.reason);
    expect(g.questions).toHaveLength(120);
    expect(g.questions.every((q) => q.options.length === 4 && q.points === 5)).toBe(true);
    expect(g.questions[0].rule).toMatchObject({ kind: "ball_outcome", innings: 1, over: 1, ball: 1, grouped: true });
    expect(g.questions[119].rule).toMatchObject({ over: 20, ball: 6 });
    expect(FOUR_BALL_OPTIONS.map((o) => o.id)).toEqual(["dot", "run", "boundary", "wicket"]);
  });
  it("covers 10 overs for T10, nothing for Tests, and honours a smaller overs setting", () => {
    const t10 = generateForTemplate(match({ format: "T10" }), everyBall());
    expect(t10.ok && t10.questions.length).toBe(60);
    expect(generateForTemplate(match({ format: "Test" }), everyBall())).toEqual({ ok: false, reason: "format_not_supported" });
    const six = generateForTemplate(match(), everyBall({ plan: { generator: "innings_balls", innings: 1, overs: 6 } }));
    expect(six.ok && six.questions.length).toBe(36);
  });
  it("fours and sixes both settle as 'boundary'; other balls keep their own option", () => {
    const rule = { kind: "ball_outcome", innings: 1, over: 1, ball: 1, grouped: true } as const;
    const at = (o: Partial<BallEvent>) => resolveQuestion(rule, { facts: facts(), events: [{ matchId: "m1", revision: 1, ...ball(1, 1, o) }] });
    expect(at({ runsBat: 4 })).toEqual({ status: "resolved", optionId: "boundary" });
    expect(at({ runsBat: 6 })).toEqual({ status: "resolved", optionId: "boundary" });
    expect(at({ runsBat: 2 })).toEqual({ status: "resolved", optionId: "run" });
    expect(at({ runsBat: 0 })).toEqual({ status: "resolved", optionId: "dot" });
    expect(at({ wicket: true })).toEqual({ status: "resolved", optionId: "wicket" });
  });
  it("scores +5 for a right pick, -1 for a wrong pick and 0 for an unanswered ball", () => {
    const g = generateForTemplate(match(), everyBall());
    if (!g.ok) throw new Error(g.reason);
    const qs = g.questions.slice(0, 4).map((q, i): import("./types").QuestionRecord => ({
      ...q, id: `q${i}`, contestId: "c1", status: i === 3 ? "void" : "resolved", resolvedOption: i === 3 ? null : ["dot", "boundary", "wicket"][i], voidReason: i === 3 ? "delivery_not_bowled" : null,
    }));
    const rules = { pointsPerCorrect: 5, negativePerWrong: 1 };
    // q0 right (+5), q1 wrong (-1), q2 unanswered (0), q3 void (not counted at all)
    const s = scoreEntry({ answers: { q0: "dot", q1: "dot", q3: "wicket" } }, qs, rules);
    expect(s.points).toBe(4);
    expect(s.correct).toBe(1);
    expect(s.scores.find((x) => x.questionId === "q3")?.counted).toBe(false);
  });
  it("creates the innings-1 contest 60 minutes before the match and opens it right away", async () => {
    const s = setup({ tpl: everyBall({ timing: { ...DEFAULT_TIMING, createBeforeMin: 60, opensBeforeMin: 60, locksBeforeMin: 1 } }) });
    expect((await runTick(s, T0 - 61 * MIN)).generated).toBe(0);
    expect((await runTick(s, T0 - 60 * MIN)).generated).toBe(1);
    const c = [...s.contests.values()][0];
    expect(c.opensAt).toBe(iso(T0 - 60 * MIN));
    expect(c.locksAt).toBe(iso(T0 - 1 * MIN));
  });
  it("an innings-2 contest locks the moment innings 2 begins, even before its scheduled lock", async () => {
    const tpl = everyBall({ plan: { generator: "innings_balls", innings: 2 }, timing: { ...DEFAULT_TIMING, trigger: "innings_break", innings: 1, createBeforeMin: 0, opensBeforeMin: 0, locksBeforeMin: 0, lockAfterMin: 20, minOpenMin: 3 } });
    const s = setup({ tpl, match: { state: "live" } });
    s.facts.set("m1", facts({ innings: [{ no: 1, team: "India", runs: 180, wickets: 5, overs: 20, complete: true }] }));
    const t1 = T0 + 100 * MIN;
    expect((await runTick(s, t1)).generated).toBe(1);
    await runTick(s, t1 + MIN);
    const c = [...s.contests.values()][0];
    expect(c.status).toBe("published");
    s.facts.set("m1", facts({ innings: [
      { no: 1, team: "India", runs: 180, wickets: 5, overs: 20, complete: true },
      { no: 2, team: "Australia", runs: 2, wickets: 0, overs: 0.4, complete: false },
    ] }));
    await runTick(s, t1 + 2 * MIN); // far earlier than the 20 minute lock
    expect(["locked", "live"]).toContain(c.status); // closed to answers; "live" because the match is in play
  });
});
