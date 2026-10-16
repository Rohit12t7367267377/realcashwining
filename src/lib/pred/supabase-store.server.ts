// Supabase implementation of PredStore. Server only (service role).
// Idempotency and integrity are enforced by the database (unique keys, triggers,
// SECURITY DEFINER functions) - this file only maps rows to engine types.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rowToFacts, rowToRef, type MatchRow } from "./facts";
import type { AnswerScore } from "./scoring";
import type { CreditInput, NewContest, Notice, PredStore, ResolveOutcome } from "./store";
import {
  DEFAULT_REWARDS,
  type BallEvent,
  type ContestRecord,
  type ContestStatus,
  type ContestTemplate,
  type EntryRecord,
  type MatchFacts,
  type MatchRef,
  type PlannedQuestion,
  type QuestionRecord,
  type Resolution,
  type RewardRules,
} from "./types";

// The generated Supabase types do not know the pred_* tables yet.
const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any

const MATCH_COLS = "id, name, status, date_time, team_a, team_b, match_type, is_live, raw, fetched_at";
const ACTIVE_BEFORE_MS = 2 * 24 * 3_600_000; // keep matches for 2 days after start (long Tests excluded on purpose)
const ACTIVE_AFTER_MS = 4 * 24 * 3_600_000;

function fail(what: string, error: { message?: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? "unknown error"}`);
}

function mapContest(r: any): ContestRecord & { cancelReason?: string | null } {
  return {
    id: r.id,
    generationKey: r.generation_key,
    templateId: r.template_id,
    categoryId: r.category_id,
    matchId: r.match_id,
    sport: r.sport,
    trigger: r.trigger,
    title: r.title,
    status: r.status,
    opensAt: r.opens_at,
    locksAt: r.locks_at,
    participantLimit: r.participant_limit,
    allowEdit: r.allow_edit,
    scoring: r.scoring,
    correctionVersion: r.correction_version ?? 0,
    cancelReason: r.cancel_reason,
  };
}

export function mapTemplate(r: any): ContestTemplate {
  return {
    id: r.id,
    categoryId: r.category_id,
    name: r.name,
    sport: r.sport,
    formats: r.formats ?? [],
    plan: r.plan,
    timing: r.timing,
    scoring: r.scoring,
    participantLimit: r.participant_limit,
    autoGenerate: r.auto_generate,
    requireApproval: r.require_approval,
    allowEdit: r.allow_edit,
    enabled: r.enabled,
  };
}

function mapQuestion(r: any): QuestionRecord {
  return {
    id: r.id,
    contestId: r.contest_id,
    position: r.position,
    prompt: r.prompt,
    options: r.options,
    rule: r.rule,
    points: r.points,
    status: r.status,
    resolvedOption: r.resolved_option,
    voidReason: r.void_reason,
  };
}

export class SupabasePredStore implements PredStore {
  constructor(private readonly opts: { refreshSeconds: number; nowMs?: () => number } = { refreshSeconds: 60 }) {}

  private now() {
    return this.opts.nowMs ? this.opts.nowMs() : Date.now();
  }

  // ---- data from the sports layer -----------------------------------------
  async listActiveMatches(): Promise<MatchRef[]> {
    const from = new Date(this.now() - ACTIVE_BEFORE_MS).toISOString();
    const to = new Date(this.now() + ACTIVE_AFTER_MS).toISOString();
    const { data, error } = await db
      .from("cricket_matches")
      .select(MATCH_COLS)
      .or(`is_live.eq.true,and(date_time.gte.${from},date_time.lte.${to})`)
      .order("date_time", { ascending: true })
      .limit(500);
    if (error) fail("Could not load matches", error);
    return (data as MatchRow[]).map(rowToRef);
  }

  async getFacts(matchId: string): Promise<MatchFacts | null> {
    const { data, error } = await db.from("cricket_matches").select(MATCH_COLS).eq("id", matchId).maybeSingle();
    if (error) fail("Could not load match", error);
    if (!data) return null;
    return rowToFacts(data as MatchRow, { nowMs: this.now(), refreshSeconds: this.opts.refreshSeconds });
  }

  async listEvents(matchId: string): Promise<BallEvent[]> {
    const { data, error } = await db
      .from("pred_events")
      .select("match_id, event_key, innings, over, seq, legal, runs_bat, extras, wicket, revision")
      .eq("match_id", matchId)
      .order("innings")
      .order("over")
      .order("seq")
      .limit(5000);
    if (error) fail("Could not load events", error);
    return (data as any[]).map((e) => ({
      eventKey: e.event_key, matchId: e.match_id, innings: e.innings, over: e.over, seq: e.seq,
      legal: e.legal, runsBat: e.runs_bat, extras: e.extras, wicket: e.wicket, revision: e.revision,
    }));
  }

  // ---- configuration ------------------------------------------------------
  async listTemplates(): Promise<ContestTemplate[]> {
    const { data, error } = await db.from("pred_templates").select("*").eq("enabled", true);
    if (error) fail("Could not load templates", error);
    return (data as any[]).map(mapTemplate);
  }

  async getRewardRules(): Promise<RewardRules> {
    const { data } = await db.from("app_settings").select("value").eq("key", "pred_reward_rules").maybeSingle();
    const v = (data?.value ?? {}) as Partial<RewardRules>;
    const int = (x: unknown, d: number, max: number) =>
      typeof x === "number" && Number.isFinite(x) ? Math.min(max, Math.max(0, Math.trunc(x))) : d;
    return {
      participation: int(v.participation, DEFAULT_REWARDS.participation, 1000),
      perCorrect: int(v.perCorrect, DEFAULT_REWARDS.perCorrect, 1000),
      rankBonus: Array.isArray(v.rankBonus)
        ? v.rankBonus.slice(0, 20).map((n) => int(n, 0, 10_000))
        : DEFAULT_REWARDS.rankBonus,
      maxPerContest: int(v.maxPerContest, DEFAULT_REWARDS.maxPerContest, 100_000),
      dailyCap: int(v.dailyCap, DEFAULT_REWARDS.dailyCap, 1_000_000),
    };
  }

  // ---- contests -----------------------------------------------------------
  async insertContest(c: NewContest): Promise<{ contest: ContestRecord; created: boolean }> {
    const { data, error } = await db.rpc("pred_insert_contest", { _c: c });
    if (error) fail("Could not create contest", error);
    const id = (data as { id: string; created: boolean }).id;
    const contest = await this.getContest(id);
    if (!contest) throw new Error("Contest was created but could not be read back");
    return { contest, created: Boolean((data as { created: boolean }).created) };
  }

  async getContest(id: string): Promise<ContestRecord | null> {
    const { data, error } = await db.from("pred_contests").select("*").eq("id", id).maybeSingle();
    if (error) fail("Could not load contest", error);
    return data ? mapContest(data) : null;
  }

  async listContests(statuses: ContestStatus[], opts?: { updatedAfterMs?: number }): Promise<ContestRecord[]> {
    let q = db.from("pred_contests").select("*").in("status", statuses).order("locks_at", { ascending: true }).limit(500);
    if (opts?.updatedAfterMs !== undefined) q = q.gte("updated_at", new Date(opts.updatedAfterMs).toISOString());
    const { data, error } = await q;
    if (error) fail("Could not list contests", error);
    return (data as any[]).map(mapContest);
  }

  /** Atomic compare-and-set: the UPDATE only matches while the status is still in `from`. */
  async transition(id: string, from: ContestStatus[], to: ContestStatus, reason?: string): Promise<boolean> {
    const patch: Record<string, unknown> = { status: to };
    if (reason) patch.cancel_reason = reason;
    const { data, error } = await db.from("pred_contests").update(patch).eq("id", id).in("status", from).select("id");
    if (error) {
      // The guard trigger rejects illegal jumps; treat that as "not in a `from` state".
      if (/invalid contest transition/i.test(error.message ?? "")) return false;
      fail("Could not change contest status", error);
    }
    return (data as unknown[]).length > 0;
  }

  async listQuestions(contestId: string): Promise<QuestionRecord[]> {
    const { data, error } = await db.from("pred_questions").select("*").eq("contest_id", contestId).order("position");
    if (error) fail("Could not load questions", error);
    return (data as any[]).map(mapQuestion);
  }

  async staticKey(questionId: string): Promise<string | null> {
    const { data, error } = await db.from("pred_question_keys").select("static_correct").eq("question_id", questionId).maybeSingle();
    if (error) fail("Could not load answer key", error);
    return data?.static_correct ?? null;
  }

  async setResolution(
    questionId: string,
    res: Exclude<Resolution, { status: "pending" }>,
    actor: string,
    reason: string,
  ): Promise<ResolveOutcome> {
    const { data, error } = await db.rpc("pred_apply_resolution", {
      _question_id: questionId,
      _status: res.status,
      _option: res.status === "resolved" ? res.optionId : null,
      _void_reason: res.status === "void" ? res.reason : null,
      _actor: actor,
      _reason: reason,
    });
    if (error) fail("Could not record result", error);
    return data as ResolveOutcome;
  }

  /** Optimistic increment: retries if two jobs race. */
  async bumpCorrectionVersion(contestId: string): Promise<number> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: cur, error } = await db.from("pred_contests").select("correction_version").eq("id", contestId).single();
      if (error) fail("Could not read correction version", error);
      const next = (cur.correction_version ?? 0) + 1;
      const { data, error: e2 } = await db
        .from("pred_contests")
        .update({ correction_version: next })
        .eq("id", contestId)
        .eq("correction_version", cur.correction_version ?? 0)
        .select("correction_version");
      if (e2) fail("Could not bump correction version", e2);
      if ((data as unknown[]).length) return next;
    }
    throw new Error("Could not bump correction version (contention)");
  }

  // ---- entries and scoring -----------------------------------------------
  async listEntries(contestId: string): Promise<EntryRecord[]> {
    const { data: entries, error } = await db
      .from("pred_entries")
      .select("id, contest_id, user_id, submitted_at, points, correct")
      .eq("contest_id", contestId)
      .limit(20_000);
    if (error) fail("Could not load entries", error);
    const { data: answers, error: e2 } = await db
      .from("pred_answers")
      .select("entry_id, question_id, option_id")
      .eq("contest_id", contestId)
      .limit(200_000);
    if (e2) fail("Could not load answers", e2);
    const byEntry = new Map<string, Record<string, string>>();
    for (const a of answers as any[]) {
      const m = byEntry.get(a.entry_id) ?? {};
      m[a.question_id] = a.option_id;
      byEntry.set(a.entry_id, m);
    }
    return (entries as any[]).map((e) => {
      const ans = byEntry.get(e.id) ?? {};
      return {
        id: e.id, contestId: e.contest_id, userId: e.user_id, submittedAt: e.submitted_at,
        answers: ans, points: e.points, correct: e.correct, answered: Object.keys(ans).length,
      };
    });
  }

  async saveScores(entryId: string, scores: AnswerScore[], totals: { points: number; correct: number }): Promise<void> {
    const { error } = await db.rpc("pred_save_scores", {
      _entry_id: entryId, _scores: scores, _points: totals.points, _correct: totals.correct,
    });
    if (error) fail("Could not save scores", error);
  }

  // ---- virtual points -----------------------------------------------------
  async ledgerTotal(userId: string, refPrefix: string): Promise<number> {
    const { data, error } = await db.from("pred_ledger").select("amount").eq("user_id", userId).like("ref_key", `${refPrefix}%`);
    if (error) fail("Could not read ledger", error);
    return (data as Array<{ amount: number }>).reduce((s, r) => s + r.amount, 0);
  }

  async creditedSince(userId: string, sinceMs: number): Promise<number> {
    const { data, error } = await db
      .from("pred_ledger").select("amount").eq("user_id", userId).gt("amount", 0)
      .gte("created_at", new Date(sinceMs).toISOString());
    if (error) fail("Could not read ledger", error);
    return (data as Array<{ amount: number }>).reduce((s, r) => s + r.amount, 0);
  }

  async credit(i: CreditInput): Promise<boolean> {
    const { data, error } = await db.rpc("pred_credit", {
      _user_id: i.userId, _amount: i.amount, _kind: i.kind, _ref_key: i.refKey, _contest_id: i.contestId ?? null,
    });
    if (error) fail("Could not credit points", error);
    return Boolean(data);
  }

  // ---- notifications / audit ---------------------------------------------
  async notify(n: Notice): Promise<boolean> {
    const { data, error } = await db
      .from("pred_notifications")
      .upsert(
        { user_id: n.userId, kind: n.kind, title: n.title, body: n.body, link: n.link ?? null, dedupe_key: n.dedupeKey },
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      )
      .select("id");
    if (error) fail("Could not create notification", error);
    return (data as unknown[]).length > 0;
  }

  async audit(action: string, actor: string, subject: string, detail: Record<string, unknown>): Promise<void> {
    // admin_audit_logs.actor_id is a uuid; system actors are recorded in metadata instead.
    const isUuid = /^[0-9a-f-]{36}$/i.test(actor);
    const { error } = await db.from("admin_audit_logs").insert({
      actor_id: isUuid ? actor : "00000000-0000-0000-0000-000000000000",
      actor_roles: [isUuid ? "admin" : "system"],
      permission_key: "predictions.engine",
      action: `pred.${action}`,
      target_type: "pred",
      target_id: subject,
      result: "success",
      metadata: { actor, ...detail },
    });
    if (error) console.error("pred audit failed", error.message); // never block settlement on logging
  }
}

export type { PlannedQuestion };
