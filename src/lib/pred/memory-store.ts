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
  type QuestionRecord,
  type Resolution,
  type RewardRules,
} from "./types";

/**
 * In-memory PredStore. It enforces the same uniqueness / state rules as the
 * database schema so the engine can be tested and simulated without Postgres.
 */
export class MemoryStore implements PredStore {
  matches = new Map<string, MatchRef>();
  facts = new Map<string, MatchFacts>();
  events = new Map<string, Map<string, BallEvent>>(); // matchId -> eventKey -> event
  templates: ContestTemplate[] = [];
  rewardRules: RewardRules = { ...DEFAULT_REWARDS };
  contests = new Map<string, ContestRecord & { updatedAt: number; cancelReason?: string }>();
  questions = new Map<string, QuestionRecord[]>();
  staticKeys = new Map<string, string>();
  entries = new Map<string, EntryRecord[]>();
  scoreRows = new Map<string, AnswerScore>(); // `${entryId}:${questionId}`
  ledger = new Map<string, CreditInput & { at: number }>();
  notices = new Map<string, Notice>();
  corrections: Array<Record<string, unknown>> = [];
  auditLog: Array<{ action: string; actor: string; subject: string; detail: Record<string, unknown> }> = [];
  clock = () => Date.now();
  private seq = 0;
  private id(p: string) { return `${p}-${++this.seq}`; }

  // ---- data from the sports layer ----
  async listActiveMatches() { return [...this.matches.values()]; }
  async getFacts(id: string) { return this.facts.get(id) ?? null; }
  async listEvents(id: string) { return [...(this.events.get(id)?.values() ?? [])]; }
  /** Provider ingestion: idempotent by eventKey; a changed payload bumps revision. */
  ingestEvents(matchId: string, list: Array<Omit<BallEvent, "revision" | "matchId">>) {
    const bucket = this.events.get(matchId) ?? new Map<string, BallEvent>();
    for (const e of list) {
      const prev = bucket.get(e.eventKey);
      const next: BallEvent = { ...e, matchId, revision: prev ? prev.revision : 1 };
      if (prev && JSON.stringify({ ...prev, revision: 0 }) !== JSON.stringify({ ...next, revision: 0 })) next.revision = prev.revision + 1;
      bucket.set(e.eventKey, next);
    }
    this.events.set(matchId, bucket);
  }

  // ---- configuration ----
  async listTemplates() { return this.templates; }
  async getRewardRules() { return this.rewardRules; }

  // ---- contests ----
  async insertContest(c: NewContest) {
    const existing = [...this.contests.values()].find((x) => x.generationKey === c.generationKey);
    if (existing) return { contest: existing, created: false };
    const id = this.id("contest");
    const rec: ContestRecord & { updatedAt: number } = {
      id, generationKey: c.generationKey, templateId: c.templateId, categoryId: c.categoryId, matchId: c.matchId,
      sport: c.sport, trigger: c.trigger, title: c.title, status: c.status, opensAt: c.opensAt, locksAt: c.locksAt,
      participantLimit: c.participantLimit, allowEdit: c.allowEdit, scoring: c.scoring, correctionVersion: 0, updatedAt: this.clock(),
    };
    this.contests.set(id, rec);
    this.questions.set(id, c.questions.map((q) => {
      const qid = this.id("q");
      if (q.staticCorrect) this.staticKeys.set(qid, q.staticCorrect);
      const { staticCorrect: _drop, ...rest } = q;
      return { ...rest, id: qid, contestId: id, status: "open" as const, resolvedOption: null, voidReason: null };
    }));
    this.entries.set(id, []);
    return { contest: rec, created: true };
  }
  async getContest(id: string) { return this.contests.get(id) ?? null; }
  async listContests(statuses: ContestStatus[], opts?: { updatedAfterMs?: number }) {
    return [...this.contests.values()].filter((c) => statuses.includes(c.status) && (opts?.updatedAfterMs === undefined || c.updatedAt >= opts.updatedAfterMs));
  }
  async transition(id: string, from: ContestStatus[], to: ContestStatus, reason?: string) {
    const c = this.contests.get(id);
    if (!c || !from.includes(c.status)) return false;
    c.status = to; c.updatedAt = this.clock(); if (reason) c.cancelReason = reason;
    return true;
  }
  async listQuestions(id: string) { return (this.questions.get(id) ?? []).map((q) => ({ ...q })); }
  async staticKey(qid: string) { return this.staticKeys.get(qid) ?? null; }
  async setResolution(qid: string, res: Exclude<Resolution, { status: "pending" }>, actor: string, reason: string): Promise<ResolveOutcome> {
    for (const list of this.questions.values()) {
      const q = list.find((x) => x.id === qid);
      if (!q) continue;
      const same = q.status === "resolved" && res.status === "resolved" ? q.resolvedOption === res.optionId : q.status === "void" && res.status === "void";
      if (same) return "unchanged";
      const wasOpen = q.status === "open";
      if (!wasOpen) this.corrections.push({ questionId: qid, before: { status: q.status, option: q.resolvedOption }, after: res, actor, reason });
      if (res.status === "resolved") {
        if (!q.options.some((o) => o.id === res.optionId)) throw new Error("Unknown option");
        q.status = "resolved"; q.resolvedOption = res.optionId; q.voidReason = null;
      } else { q.status = "void"; q.resolvedOption = null; q.voidReason = res.reason; }
      const c = this.contests.get(q.contestId); if (c) c.updatedAt = this.clock();
      return wasOpen ? "applied" : "changed";
    }
    throw new Error("Question not found");
  }
  async bumpCorrectionVersion(id: string) {
    const c = this.contests.get(id)!; c.correctionVersion += 1; c.updatedAt = this.clock(); return c.correctionVersion;
  }

  // ---- entries ----
  /** Mirrors the SQL RPC rules: published only, before lock, one entry per user, valid options. */
  join(contestId: string, userId: string, answers: Record<string, string>, nowMs: number) {
    const c = this.contests.get(contestId);
    if (!c) throw new Error("Contest not found");
    if (c.status !== "published") throw new Error("Contest is not open");
    if (nowMs >= Date.parse(c.locksAt)) throw new Error("Contest is locked");
    const list = this.entries.get(contestId)!;
    const existing = list.find((e) => e.userId === userId);
    if (existing && !c.allowEdit) throw new Error("Answers are final once submitted");
    if (!existing && c.participantLimit !== null && list.length >= c.participantLimit) throw new Error("Contest is full");
    const qs = this.questions.get(contestId)!;
    for (const [qid, opt] of Object.entries(answers)) {
      const q = qs.find((x) => x.id === qid);
      if (!q || !q.options.some((o) => o.id === opt)) throw new Error("Invalid answer");
    }
    if (existing) { existing.answers = { ...answers }; return existing; }
    const e: EntryRecord = { id: this.id("entry"), contestId, userId, submittedAt: new Date(nowMs).toISOString(), answers: { ...answers }, points: 0, correct: 0, answered: Object.keys(answers).length };
    list.push(e);
    return e;
  }
  async listEntries(id: string) { return (this.entries.get(id) ?? []).map((e) => ({ ...e, answers: { ...e.answers } })); }
  async saveScores(entryId: string, scores: AnswerScore[], totals: { points: number; correct: number }) {
    for (const s of scores) if (s.counted) this.scoreRows.set(`${entryId}:${s.questionId}`, s);
    for (const list of this.entries.values()) {
      const e = list.find((x) => x.id === entryId);
      if (e) { e.points = totals.points; e.correct = totals.correct; }
    }
  }

  // ---- ledger ----
  async ledgerTotal(userId: string, prefix: string) {
    let t = 0;
    for (const [k, v] of this.ledger) if (v.userId === userId && k.startsWith(prefix)) t += v.amount;
    return t;
  }
  async creditedSince(userId: string, sinceMs: number) {
    let t = 0;
    for (const v of this.ledger.values()) if (v.userId === userId && v.amount > 0 && v.at >= sinceMs) t += v.amount;
    return t;
  }
  async credit(i: CreditInput) {
    if (this.ledger.has(i.refKey)) return false; // unique(ref_key)
    this.ledger.set(i.refKey, { ...i, at: this.clock() });
    return true;
  }
  balance(userId: string) {
    let t = 0;
    for (const v of this.ledger.values()) if (v.userId === userId) t += v.amount;
    return t;
  }

  // ---- notifications / audit ----
  async notify(n: Notice) {
    if (this.notices.has(n.dedupeKey)) return false; // unique(dedupe_key)
    this.notices.set(n.dedupeKey, n);
    return true;
  }
  async audit(action: string, actor: string, subject: string, detail: Record<string, unknown>) {
    this.auditLog.push({ action, actor, subject, detail });
  }
}
