import {
  detectMilestone,
  planMilestoneWindow,
  planPreMatchWindow,
} from "./timing";
import { generateForTemplate, generationKey, normalizeFormat } from "./generate";
import { resolveQuestion } from "./outcomes";
import { applyDailyCap, desiredRewards, rewardRefKey, rewardRefPrefix } from "./rewards";
import { rankEntries, scoreEntry } from "./scoring";
import type { PredStore, Notice } from "./store";
import type { ContestRecord, MatchRef, MatchState, QuestionRecord, Resolution } from "./types";

const MIN = 60_000;
const DEAD_STATES: MatchState[] = ["cancelled", "postponed", "abandoned"];
const FINAL_STATES: MatchState[] = ["completed", "cancelled", "abandoned"];
const CORRECTION_WINDOW_MS = 48 * 60 * MIN;
const DEADLINE_REMINDER_MS = 10 * MIN;

export interface TickReport {
  generated: number;
  skipped: Record<string, number>;
  published: number;
  locked: number;
  cancelled: number;
  resolved: number;
  completed: number;
  corrections: number;
  credited: number;
  notices: number;
  errors: string[];
}

export const emptyReport = (): TickReport => ({
  generated: 0, skipped: {}, published: 0, locked: 0, cancelled: 0, resolved: 0,
  completed: 0, corrections: 0, credited: 0, notices: 0, errors: [],
});

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
export async function generateContests(store: PredStore, matches: MatchRef[], nowMs: number, r: TickReport) {
  const templates = (await store.listTemplates()).filter((t) => t.enabled && t.autoGenerate);
  const skip = (reason: string) => { r.skipped[reason] = (r.skipped[reason] ?? 0) + 1; };

  for (const m of matches) {
    if (DEAD_STATES.includes(m.state)) continue;
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

      const key = generationKey(t.id, m.id, t.timing.trigger, t.timing.trigger === "pre_match" ? `pre@${m.startsAt}` : ms.key);
      const window = t.timing.trigger === "pre_match" ? planPreMatchWindow(t.timing, m.startsAt, nowMs) : planMilestoneWindow(t.timing, nowMs);
      if (!window.create) {
        if (window.reason !== "too_early" && window.reason !== "match_started") skip(window.reason);
        continue;
      }
      const gen = generateForTemplate(m, t, ms);
      if (!gen.ok) { skip(gen.reason); continue; }

      const { created } = await store.insertContest({
        generationKey: key,
        templateId: t.id,
        categoryId: t.categoryId,
        matchId: m.id,
        sport: m.sport,
        trigger: t.timing.trigger,
        title: gen.title,
        status: t.requireApproval ? "draft" : "scheduled",
        opensAt: window.opensAt,
        locksAt: window.locksAt,
        participantLimit: t.participantLimit,
        allowEdit: t.allowEdit,
        scoring: t.scoring,
        questions: gen.questions,
      });
      if (created) r.generated++;
    }
  }
}

// ---------------------------------------------------------------------------
// Step 2: lifecycle (draft/scheduled -> published -> locked, cancellations)
// ---------------------------------------------------------------------------
export async function advanceLifecycle(store: PredStore, matches: MatchRef[], nowMs: number, r: TickReport) {
  const stateOf = new Map(matches.map((m) => [m.id, m.state]));
  const open = await store.listContests(["draft", "scheduled", "published"]);

  for (const c of open) {
    const mState = c.matchId ? stateOf.get(c.matchId) ?? (await store.getFacts(c.matchId))?.state : undefined;
    const locksAt = Date.parse(c.locksAt);
    const opensAt = Date.parse(c.opensAt);

    if (mState && DEAD_STATES.includes(mState)) {
      if (await store.transition(c.id, ["draft", "scheduled", "published"], "cancelled", `match_${mState}`)) {
        r.cancelled++;
        await store.audit("contest.cancelled", "system", c.id, { reason: `match_${mState}` });
        await notify(store, r, { userId: null, kind: "contest", title: "Contest cancelled", body: `${c.title} was cancelled because the match was ${mState}.`, link: "/predict", dedupeKey: `contest-cancelled:${c.id}` });
      }
      continue;
    }

    if (c.status !== "published") {
      if (nowMs >= locksAt) {
        if (await store.transition(c.id, ["draft", "scheduled"], "cancelled", "expired_unpublished")) r.cancelled++;
      } else if (c.status === "scheduled" && nowMs >= opensAt) {
        if (await store.transition(c.id, ["scheduled"], "published")) {
          r.published++;
          await notify(store, r, { userId: null, kind: "contest", title: "New free contest", body: `${c.title} is open. Make your picks before it locks.`, link: `/predict/${c.id}`, dedupeKey: `contest-open:${c.id}` });
        }
      }
      continue;
    }

    // published
    const startedEarly = c.trigger === "pre_match" && (mState === "live" || mState === "completed");
    if (nowMs >= locksAt || startedEarly) {
      if (await store.transition(c.id, ["published"], "locked")) r.locked++;
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

export async function settleContests(store: PredStore, nowMs: number, r: TickReport) {
  const contests = [
    ...(await store.listContests(["locked", "settling"])),
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
      });
      if (res.status === "pending") continue;
      if (q.status === "resolved" && res.status === "resolved" && q.resolvedOption === res.optionId) continue;
      if (q.status === "void" && res.status === "void") continue;

      const out = await store.setResolution(q.id, res, "system", q.status === "open" ? "verified_provider_data" : "provider_correction");
      if (out === "applied") { r.resolved++; touched = true; }
      else if (out === "changed") { corrections++; r.corrections++; touched = true; }
    }

    if (touched) questions = await store.listQuestions(c.id);
    if (c.status === "locked" && touched) await store.transition(c.id, ["locked"], "settling");

    const allClosed = questions.length > 0 && questions.every((q) => q.status !== "open");
    const final = !c.matchId || (facts !== null && FINAL_STATES.includes(facts.state));

    if (c.status === "completed") {
      if (corrections > 0) {
        const version = await store.bumpCorrectionVersion(c.id);
        const entries = await rescore(store, c, questions);
        await reconcileRewards(store, c, entries, version, nowMs, r);
        await store.audit("contest.provider_correction", "system", c.id, { version, corrections });
      }
      continue;
    }

    if (touched || allClosed) {
      const entries = await rescore(store, c, questions);
      if (allClosed && final) {
        if (questions.every((q) => q.status === "void")) {
          if (await store.transition(c.id, ["locked", "settling"], "cancelled", "all_questions_void")) {
            r.cancelled++;
            await reconcileRewards(store, c, entries, 0, nowMs, r, true);
            await notify(store, r, { userId: null, kind: "contest", title: "Contest voided", body: `${c.title} was voided: no question could be verified.`, link: "/predict", dedupeKey: `contest-void:${c.id}` });
          }
        } else if (await store.transition(c.id, ["locked", "settling"], "completed")) {
          r.completed++;
          await reconcileRewards(store, c, entries, 0, nowMs, r);
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

export async function cancelContest(store: PredStore, contestId: string, actor: string, reason: string) {
  const ok = await store.transition(contestId, ["draft", "scheduled", "published"], "cancelled", reason);
  if (ok) await store.audit("contest.cancelled", actor, contestId, { reason });
  return ok;
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
  if (!contest || !["locked", "settling", "completed"].includes(contest.status)) throw new Error("Contest not found or not in a settleable state.");
  const out = await store.setResolution(questionId, res, actor, reason);
  await store.audit("question.corrected", actor, questionId, { contestId, res, reason, outcome: out });
  const r = emptyReport();
  const questions = await store.listQuestions(contestId);
  const entries = await rescore(store, contest, questions);
  if (contest.status === "completed" && out === "changed") {
    const version = await store.bumpCorrectionVersion(contestId);
    await reconcileRewards(store, contest, entries, version, nowMs, r);
  }
  return { outcome: out, credited: r.credited };
}
