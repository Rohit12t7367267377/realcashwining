import {
  detectMilestone,
  planMilestoneWindow,
  planPreMatchWindow,
} from "./timing";
import { expandTemplate, generationKey, normalizeFormat } from "./generate";
import { feeRefKey, planPool, platformRefKey, prizeRefKey, prizeRefPrefix, refundRefKey } from "./economy";
import { resolveQuestion } from "./outcomes";
import { applyDailyCap, desiredRewards, rewardRefKey, rewardRefPrefix } from "./rewards";
import { rankEntries, scoreEntry } from "./scoring";
import type { PredStore, Notice } from "./store";
import type { ContestRecord, MatchRef, MatchState, QuestionRecord, Resolution } from "./types";

const MIN = 60_000;
const DEAD_STATES: MatchState[] = ["cancelled", "postponed", "abandoned"];
const FINAL_STATES: MatchState[] = ["completed", "cancelled", "abandoned"];
const REFUND_SWEEP_MS = 14 * 24 * 60 * MIN;
const CORRECTION_WINDOW_MS = 48 * 60 * MIN;
const DEADLINE_REMINDER_MS = 10 * MIN;

export interface TickReport {
  generated: number;
  skipped: Record<string, number>;
  published: number;
  locked: number;
  cancelled: number;
  voided: number;
  refunded: number;
  resolved: number;
  completed: number;
  corrections: number;
  credited: number;
  notices: number;
  errors: string[];
}

export const emptyReport = (): TickReport => ({
  generated: 0, skipped: {}, published: 0, locked: 0, cancelled: 0, voided: 0, refunded: 0, resolved: 0,
  completed: 0, corrections: 0, credited: 0, notices: 0, errors: [],
});

export interface GenerateOptions {
  /** Manual generation by an admin: ignores the global pause, exclusions and the "too early" window. */
  force?: boolean;
  matchIds?: string[];
  templateIds?: string[];
}

const utcDayStart = (ms: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

async function notify(store: PredStore, report: TickReport, n: Notice) {
  if (await store.notify(n)) report.notices++;
}

// ---------------------------------------------------------------------------
// Step 0: match-level notices (upcoming, started, postponed, cancelled)
// ---------------------------------------------------------------------------
async function matchNotices(store: PredStore, matches: MatchRef[], nowMs: number, r: TickReport) {
  for (const m of matches) {
    const name = `${m.teamA} vs ${m.teamB}`;
    const start = m.startsAt ? Date.parse(m.startsAt) : NaN;
    if (m.state === "upcoming" && Number.isFinite(start) && start - nowMs < 3 * 60 * MIN && start > nowMs) {
      await notify(store, r, { userId: null, kind: "match", title: "Match starting soon", body: `${name} starts soon. Check the free prediction contests.`, link: "/predict", dedupeKey: `match-upcoming:${m.id}:${m.startsAt}` });
    } else if (m.state === "live") {
      await notify(store, r, { userId: null, kind: "match", title: "Match is live", body: `${name} has started.`, link: "/live-scores", dedupeKey: `match-live:${m.id}` });
    } else if (m.state === "postponed" || m.state === "cancelled" || m.state === "abandoned") {
      await notify(store, r, { userId: null, kind: "match", title: `Match ${m.state}`, body: `${name} was ${m.state}. Related contests are cancelled or voided.`, link: "/predict", dedupeKey: `match-${m.state}:${m.id}` });
    }
  }
}

// ---------------------------------------------------------------------------
// Step 1: automatic contest generation
// ---------------------------------------------------------------------------
export async function generateContests(store: PredStore, matches: MatchRef[], nowMs: number, r: TickReport, opts: GenerateOptions = {}) {
  const controls = await store.getControls();
  if (controls.pauseGeneration && !opts.force) { r.skipped.generation_paused = (r.skipped.generation_paused ?? 0) + 1; return; }
  const templates = (await store.listTemplates()).filter((t) => t.enabled && (opts.force || t.autoGenerate) && (!opts.templateIds || opts.templateIds.includes(t.id)));
  const skip = (reason: string) => { r.skipped[reason] = (r.skipped[reason] ?? 0) + 1; };

  for (const m of matches) {
    if (DEAD_STATES.includes(m.state)) continue;
    if (opts.matchIds && !opts.matchIds.includes(m.id)) continue;
    if (!opts.force) {
      if (controls.excludedMatchIds.includes(m.id)) { skip("match_excluded"); continue; }
      if (controls.disabledSports.includes(m.sport)) { skip("sport_disabled"); continue; }
      if (m.series && controls.disabledSeries.includes(m.series)) { skip("competition_disabled"); continue; }
    }
    let facts: Awaited<ReturnType<PredStore["getFacts"]>> | undefined;
    let events: Awaited<ReturnType<PredStore["listEvents"]>> | undefined;

    for (const t of templates) {
      if (t.sport !== m.sport) continue;
      if (t.formats.length && !t.formats.map(normalizeFormat).includes(normalizeFormat(m.format))) continue;

      if (t.timing.trigger !== "pre_match" && facts === undefined) {
        facts = await store.getFacts(m.id);
        events = await store.listEvents(m.id);
      }
      const ms = detectMilestone(t.timing, m, facts ?? null, events ?? []);
      if (!ms) continue;

      const timing = opts.force ? { ...t.timing, createBeforeMin: Math.max(t.timing.createBeforeMin, 10080) } : t.timing;
      const baseKey = generationKey(t.id, m.id, t.timing.trigger, t.timing.trigger === "pre_match" ? `pre@${m.startsAt}` : ms.key);
      const window = t.timing.trigger === "pre_match" ? planPreMatchWindow(timing, m.startsAt, nowMs) : planMilestoneWindow(timing, nowMs);
      if (!window.create) {
        if (window.reason !== "too_early" && window.reason !== "match_started") skip(window.reason);
        continue;
      }
      const gen = expandTemplate(m, t, ms);
      if (!gen.ok) { skip(gen.reason); continue; }

      const keyed = gen.contests.map((c) => ({ ...c, key: c.keySuffix ? `${baseKey}:${c.keySuffix}` : baseKey }));
      const have = await store.existingContestKeys(keyed.map((c) => c.key));
      for (const c of keyed) {
        if (have.has(c.key)) continue; // already generated (or manually cancelled): never recreated
        const { created } = await store.insertContest({
          generationKey: c.key,
          templateId: t.id,
          categoryId: t.categoryId,
          matchId: m.id,
          sport: m.sport,
          trigger: t.timing.trigger,
          title: c.title,
          status: t.requireApproval ? "draft" : "scheduled",
          opensAt: window.opensAt,
          locksAt: window.locksAt,
          participantLimit: t.participantLimit,
          entryFee: t.entryFee,
          minParticipants: t.minParticipants,
          prizeSplit: t.prizeSplit,
          allowEdit: t.allowEdit,
          scoring: t.scoring,
          questions: c.questions,
        });
        if (created) r.generated++;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Step 2: lifecycle (draft/scheduled -> published -> locked, cancellations)
// ---------------------------------------------------------------------------
/**
 * True once play that the contest asks about has begun, so answers must close even if the
 * scheduled lock time has not arrived (a late provider update must never leave picks open
 * after the ball is bowled).
 */
async function playStartedBeforeLock(store: PredStore, c: ContestRecord, mState: string | undefined): Promise<boolean> {
  if (mState === "completed") return true;
  if (c.trigger === "pre_match") return mState === "live";
  if (c.trigger === "innings_break" && c.matchId) {
    const n = Number(/(?:^|:)inn(\d+)$/.exec(c.generationKey)?.[1]);
    if (!n) return false;
    const f = await store.getFacts(c.matchId);
    return Boolean(f?.innings.some((i) => i.no === n + 1 && (i.overs > 0 || i.runs > 0)));
  }
  return false;
}

/** Returns every entry fee of a cancelled / voided contest. Idempotent: the ledger key is unique per player. */
export async function refundContest(store: PredStore, c: ContestRecord, r: TickReport) {
  const entries = await store.listEntries(c.id);
  for (const e of entries) {
    if (e.feePaid <= 0) continue;
    const ok = await store.credit({ userId: e.userId, amount: e.feePaid, kind: "refund", contestId: c.id, refKey: refundRefKey(c.id, e.userId) });
    if (ok) {
      r.refunded += e.feePaid;
      await store.notify({ userId: e.userId, kind: "reward", title: "Entry points refunded", body: `${e.feePaid} points were returned because ${c.title} did not go ahead.`, link: "/predict", dedupeKey: `refund:${c.id}:${e.userId}` });
    }
  }
  await store.markRefunded(c.id);
}

/** Cancel (before lock) or void (after lock) with a recorded reason, then return the entry points. */
async function closeAndRefund(store: PredStore, c: ContestRecord, to: "cancelled" | "void", reason: string, actor: string, r: TickReport, why?: string) {
  const from: ContestRecord["status"][] = to === "cancelled" ? ["draft", "scheduled", "published", "locked"] : ["locked", "live", "settling"];
  if (!(await store.transition(c.id, from, to, reason))) return false;
  if (to === "cancelled") r.cancelled++; else r.voided++;
  await store.audit(`contest.${to}`, actor, c.id, { reason });
  await refundContest(store, c, r);
  await notify(store, r, { userId: null, kind: "contest", title: to === "void" ? "Contest voided" : "Contest cancelled", body: `${c.title}: ${why ?? reason.replace(/_/g, " ")}. Entry points are returned.`, link: "/predict", dedupeKey: `contest-${to}:${c.id}` });
  return true;
}

export async function advanceLifecycle(store: PredStore, matches: MatchRef[], nowMs: number, r: TickReport) {
  const controls = await store.getControls();
  const matchOf = new Map(matches.map((m) => [m.id, m]));
  const open = await store.listContests(["draft", "scheduled", "published", "locked", "live"]);

  for (const c of open) {
    const m = c.matchId ? matchOf.get(c.matchId) : undefined;
    const mState = c.matchId ? m?.state ?? (await store.getFacts(c.matchId))?.state : undefined;
    const locksAt = Date.parse(c.locksAt);
    const opensAt = Date.parse(c.opensAt);
    const preLock = c.status === "draft" || c.status === "scheduled" || c.status === "published";

    // Match cancelled / postponed / abandoned
    if (mState && DEAD_STATES.includes(mState)) {
      if (preLock) { await closeAndRefund(store, c, "cancelled", `match_${mState}`, "system", r, `the match was ${mState}`); continue; }
      // already locked: postponed always voids (the questions were about the original schedule);
      // abandoned/cancelled follows the operator policy (default: settle what was verified, void the rest)
      if (mState === "postponed" || controls.abandonPolicy === "refund_all") {
        await closeAndRefund(store, c, "void", `match_${mState}`, "system", r, `the match was ${mState}`);
        continue;
      }
    }

    // Start time moved while the match is still upcoming: contests built for the old time are replaced.
    if (m && c.trigger === "pre_match" && m.state === "upcoming" && m.startsAt && !c.generationKey.includes(`pre@${m.startsAt}`)) {
      await closeAndRefund(store, c, preLock ? "cancelled" : "void", "match_rescheduled", "system", r, "the match was rescheduled; new contests follow the new start time");
      continue;
    }

    if (c.status === "locked") {
      if (mState === "live" && (await store.transition(c.id, ["locked"], "live"))) await store.audit("contest.live", "system", c.id, {});
      continue;
    }
    if (c.status === "live") continue;

    if (c.status !== "published") {
      if (nowMs >= locksAt) {
        await store.transition(c.id, ["draft", "scheduled"], "cancelled", "expired_unpublished") && r.cancelled++;
      } else if (c.status === "scheduled" && nowMs >= opensAt && !controls.pausePublication) {
        if (await store.transition(c.id, ["scheduled"], "published")) {
          r.published++;
          await notify(store, r, { userId: null, kind: "contest", title: "New contest open", body: `${c.title} is open. Make your picks before it locks.`, link: `/predict/${c.id}`, dedupeKey: `contest-open:${c.id}` });
        }
      }
      continue;
    }

    // published
    const startedEarly = await playStartedBeforeLock(store, c, mState);
    if (nowMs >= locksAt || startedEarly) {
      const entries = await store.countEntries(c.id);
      if (c.minParticipants > 0 && entries < c.minParticipants) {
        await closeAndRefund(store, c, "cancelled", "min_participants_not_met", "system", r, `only ${entries} of the ${c.minParticipants} required players joined`);
      } else if (await store.transition(c.id, ["published"], mState === "live" ? "live" : "locked")) r.locked++;
    } else if (locksAt - nowMs <= DEADLINE_REMINDER_MS) {
      await notify(store, r, { userId: null, kind: "deadline", title: "Contest closing soon", body: `${c.title} locks in a few minutes.`, link: `/predict/${c.id}`, dedupeKey: `contest-closing:${c.id}` });
    }
  }
}

// ---------------------------------------------------------------------------
// Step 3: verification, scoring, completion, rewards
// ---------------------------------------------------------------------------
async function rescore(store: PredStore, c: ContestRecord, questions: QuestionRecord[]) {
  const entries = await store.listEntries(c.id);
  for (const e of entries) {
    const s = scoreEntry(e, questions, c.scoring);
    await store.saveScores(e.id, s.scores, { points: s.points, correct: s.correct }); // idempotent upsert
    e.points = s.points; e.correct = s.correct; e.answered = s.answered;
  }
  return entries;
}

async function reconcileRewards(
  store: PredStore, c: ContestRecord, entries: Awaited<ReturnType<PredStore["listEntries"]>>,
  version: number, nowMs: number, r: TickReport, cancelled = false,
) {
  const rules = await store.getRewardRules();
  const ranked = rankEntries(entries.map((e) => ({ userId: e.userId, entryId: e.id, points: e.points, correct: e.correct, submittedAt: e.submittedAt })));
  const answered = new Map(entries.map((e) => [e.userId, e.answered]));
  const desired = desiredRewards(ranked.map((x) => ({ ...x, answered: answered.get(x.userId) ?? 0 })), rules, cancelled);
  const rankOf = new Map(ranked.map((x) => [x.userId, x.rank]));

  for (const d of desired) {
    const held = await store.ledgerTotal(d.userId, rewardRefPrefix(c.id, d.userId));
    const delta = d.total - held;
    if (delta !== 0) {
      const today = await store.creditedSince(d.userId, utcDayStart(nowMs));
      const amount = applyDailyCap(delta, today, rules.dailyCap);
      if (amount !== 0) {
        const applied = await store.credit({
          userId: d.userId, amount, kind: version > 0 ? "adjustment" : "contest_reward", contestId: c.id,
          refKey: `${rewardRefKey(c.id, d.userId, version)}:from${held}`,
        });
        if (applied) r.credited += amount;
      }
    }
    if (cancelled) continue;
    const link = `/predict/${c.id}`;
    if (version === 0) {
      await notify(store, r, { userId: d.userId, kind: "result", title: "Result verified", body: `You ranked #${rankOf.get(d.userId)} of ${ranked.length} in ${c.title}.`, link, dedupeKey: `result:${c.id}:${d.userId}:v0` });
      if (d.total > 0) await notify(store, r, { userId: d.userId, kind: "reward", title: "Virtual points credited", body: `${d.total} points added for ${c.title}.`, link: "/predict", dedupeKey: `reward:${c.id}:${d.userId}:v0` });
    } else if (delta !== 0) {
      await notify(store, r, { userId: d.userId, kind: "correction", title: "Result corrected", body: `An official correction changed the result of ${c.title}. Your points were updated.`, link, dedupeKey: `correction:${c.id}:${d.userId}:v${version}` });
    }
  }
}

/**
 * Pays an entry-fee contest from its virtual-point pool. Reconciles against what the ledger already holds,
 * so a retried or corrected settlement only pays/claws back the difference and can never pay twice.
 */
async function settlePool(
  store: PredStore, c: ContestRecord, entries: Awaited<ReturnType<PredStore["listEntries"]>>,
  version: number, r: TickReport,
) {
  const ranked = rankEntries(entries.map((e) => ({ userId: e.userId, entryId: e.id, points: e.points, correct: e.correct, submittedAt: e.submittedAt })));
  const feeOf = new Map(entries.map((e) => [e.userId, e.feePaid]));
  const answeredOf = new Map(entries.map((e) => [e.userId, e.answered]));
  // Only players who actually answered can win; ranks are recomputed among them.
  const eligible = ranked.filter((x) => (answeredOf.get(x.userId) ?? 0) > 0).map((x, i) => ({ userId: x.userId, rank: i + 1, feePaid: 0 }));
  const pool = entries.reduce((t, e) => t + e.feePaid, 0);
  const plan = planPool(eligible, c.prizeSplit, pool);
  const prizes = plan.payouts;
  const prizeTotal = prizes.reduce((t, x) => t + x.amount, 0);
  const wanted = new Map(prizes.map((x) => [x.userId, x]));
  const everyone = new Set([...wanted.keys(), ...entries.map((e) => e.userId)]);

  for (const userId of everyone) {
    const want = wanted.get(userId)?.amount ?? 0;
    const held = await store.ledgerTotal(userId, prizeRefPrefix(c.id, userId));
    const delta = want - held;
    if (delta === 0) continue;
    const applied = await store.credit({ userId, amount: delta, kind: version > 0 ? "adjustment" : "prize", contestId: c.id, refKey: prizeRefKey(c.id, userId, version, held) });
    if (applied) {
      r.credited += delta;
      if (version === 0 && delta > 0) await notify(store, r, { userId, kind: "reward", title: "You won virtual points", body: `${delta} points added for ranking #${wanted.get(userId)!.rank} in ${c.title}.`, link: "/predict", dedupeKey: `prize:${c.id}:${userId}:v0` });
      else if (version > 0) await notify(store, r, { userId, kind: "correction", title: "Result corrected", body: `An official correction changed the result of ${c.title}. Your points were updated.`, link: `/predict/${c.id}`, dedupeKey: `correction:${c.id}:${userId}:v${version}` });
    }
  }

  const platformShare = pool - prizeTotal;
  const heldByPlatform = await store.platformHeld(c.id);
  if (platformShare !== heldByPlatform) {
    await store.platformCredit({ contestId: c.id, amount: platformShare - heldByPlatform, kind: "contest_share", refKey: `${platformRefKey(c.id)}:v${version}:from${heldByPlatform}` });
  }
  await store.saveSettlement({ contestId: c.id, version, participants: entries.length, pool, prizeTotal, platformShare, payouts: prizes });
  if (version === 0) {
    for (const e of ranked) {
      await notify(store, r, { userId: e.userId, kind: "result", title: "Result verified", body: `You ranked #${e.rank} of ${ranked.length} in ${c.title}.`, link: `/predict/${c.id}`, dedupeKey: `result:${c.id}:${e.userId}:v0` });
    }
  }
  void feeOf;
}

/** Rewards for a contest: free practice contests mint participation points; paid contests pay from the pool. */
async function payContest(
  store: PredStore, c: ContestRecord, entries: Awaited<ReturnType<PredStore["listEntries"]>>,
  version: number, nowMs: number, r: TickReport,
) {
  if (c.entryFee > 0 || entries.some((e) => e.feePaid > 0)) await settlePool(store, c, entries, version, r);
  else await reconcileRewards(store, c, entries, version, nowMs, r);
}

export async function settleContests(store: PredStore, nowMs: number, r: TickReport) {
  const controls = await store.getControls();
  // Safety net: a cancelled/void contest whose refunds were interrupted is finished here (idempotent).
  for (const c of await store.listContests(["cancelled", "void"], { updatedAfterMs: nowMs - REFUND_SWEEP_MS })) {
    if (!c.refundedAt) await refundContest(store, c, r);
  }
  if (controls.pauseSettlement) { r.skipped.settlement_paused = (r.skipped.settlement_paused ?? 0) + 1; return; }

  const contests = [
    ...(await store.listContests(["locked", "live", "settling"])),
    ...(await store.listContests(["completed"], { updatedAfterMs: nowMs - CORRECTION_WINDOW_MS })),
  ];

  for (const c of contests) {
    const facts = c.matchId ? await store.getFacts(c.matchId) : null;
    const events = c.matchId ? await store.listEvents(c.matchId) : [];
    let questions = await store.listQuestions(c.id);
    let touched = false;
    let corrections = 0;

    for (const q of questions) {
      const res: Resolution = resolveQuestion(q.rule, {
        facts, events,
        staticCorrect: q.rule.kind === "static" ? await store.staticKey(q.id) : null,
        hasDrawOption: q.options.some((o) => o.id === "draw"),
        optionIds: q.options.map((o) => o.id),
      });
      if (res.status === "pending") continue;
      if (q.status === "resolved" && res.status === "resolved" && q.resolvedOption === res.optionId) continue;
      if (q.status === "void" && res.status === "void") continue;

      const out = await store.setResolution(q.id, res, "system", q.status === "open" ? "verified_provider_data" : "provider_correction");
      if (out === "applied") { r.resolved++; touched = true; }
      else if (out === "changed") { corrections++; r.corrections++; touched = true; }
    }

    if (touched) questions = await store.listQuestions(c.id);
    if ((c.status === "locked" || c.status === "live") && touched) await store.transition(c.id, ["locked", "live"], "settling");

    const allClosed = questions.length > 0 && questions.every((q) => q.status !== "open");
    const final = !c.matchId || (facts !== null && FINAL_STATES.includes(facts.state));

    if (c.status === "completed") {
      if (corrections > 0) {
        const version = await store.bumpCorrectionVersion(c.id);
        const entries = await rescore(store, c, questions);
        await payContest(store, c, entries, version, nowMs, r);
        await store.audit("contest.provider_correction", "system", c.id, { version, corrections });
      }
      continue;
    }

    if (touched || allClosed) {
      const entries = await rescore(store, c, questions);
      if (allClosed && final) {
        if (questions.every((q) => q.status === "void")) {
          await closeAndRefund(store, c, "void", "all_questions_void", "system", r, "no question could be verified from provider data");
        } else if (await store.transition(c.id, ["locked", "live", "settling"], "completed")) {
          r.completed++;
          await payContest(store, c, entries, 0, nowMs, r);
          await store.audit("contest.completed", "system", c.id, { entries: entries.length });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Orchestration + administrator operations
// ---------------------------------------------------------------------------
export async function runTick(store: PredStore, nowMs: number): Promise<TickReport> {
  const r = emptyReport();
  let matches: MatchRef[] = [];
  const step = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { r.errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`); }
  };
  await step("matches", async () => { matches = await store.listActiveMatches(); });
  await step("notices", () => matchNotices(store, matches, nowMs, r));
  await step("generate", () => generateContests(store, matches, nowMs, r));
  await step("lifecycle", () => advanceLifecycle(store, matches, nowMs, r));
  await step("settle", () => settleContests(store, nowMs, r));
  return r;
}

/** Approve a drafted contest. It publishes on the next tick if its window is still open. */
export async function approveContest(store: PredStore, contestId: string, actor: string) {
  const ok = await store.transition(contestId, ["draft"], "scheduled");
  if (ok) await store.audit("contest.approved", actor, contestId, {});
  return ok;
}

/**
 * Admin cancel/void with a recorded reason. Before lock the contest is cancelled; after lock it is voided.
 * Either way every entry fee is returned. A settled contest cannot be voided here (use a correction).
 */
export async function cancelContest(store: PredStore, contestId: string, actor: string, reason: string) {
  if (reason.trim().length < 3) throw new Error("A reason is required.");
  const c = await store.getContest(contestId);
  if (!c) return false;
  const r = emptyReport();
  const to = ["draft", "scheduled", "published"].includes(c.status) ? "cancelled" : "void";
  return closeAndRefund(store, c, to, reason.trim(), actor, r, reason.trim());
}

/** Admin re-run of the settlement/refund job for one contest. Safe to repeat: every payment is keyed. */
export async function rerunContest(store: PredStore, contestId: string, actor: string, nowMs: number) {
  const c = await store.getContest(contestId);
  if (!c) throw new Error("Contest not found");
  const r = emptyReport();
  if (c.status === "cancelled" || c.status === "void") await refundContest(store, c, r);
  else if (c.status === "completed") {
    const entries = await rescore(store, c, await store.listQuestions(c.id));
    await payContest(store, c, entries, c.correctionVersion, nowMs, r);
  } else await settleContests(store, nowMs, r);
  await store.audit("contest.rerun", actor, contestId, { refunded: r.refunded, credited: r.credited });
  return r;
}

/**
 * Authorised, logged result change (or manual resolution). Re-scores the
 * contest and reconciles virtual rewards when it was already completed.
 */
export async function correctQuestion(
  store: PredStore, contestId: string, questionId: string,
  res: Exclude<Resolution, { status: "pending" }>, actor: string, reason: string, nowMs: number,
) {
  if (reason.trim().length < 5) throw new Error("A reason of at least 5 characters is required.");
  const contest = await store.getContest(contestId);
  if (!contest || !["locked", "live", "settling", "completed"].includes(contest.status)) throw new Error("Contest not found or not in a settleable state.");
  const out = await store.setResolution(questionId, res, actor, reason);
  await store.audit("question.corrected", actor, questionId, { contestId, res, reason, outcome: out });
  const r = emptyReport();
  const questions = await store.listQuestions(contestId);
  const entries = await rescore(store, contest, questions);
  if (contest.status === "completed" && out === "changed") {
    const version = await store.bumpCorrectionVersion(contestId);
    await payContest(store, contest, entries, version, nowMs, r);
  }
  return { outcome: out, credited: r.credited };
}
