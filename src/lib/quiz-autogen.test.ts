import { describe, expect, it, vi } from "vitest";
import { computeSlot, contestWindow, parseQuizAutogenConfig, quizAutogenConfigSchema, validateGeneratedQuestions, type GeneratedQuestion, type QuizAutogenConfig, type QuizScope } from "./quiz-autogen";
import { runQuizAutogen, type ClaimResult, type QuizAutogenStore } from "./quiz-autogen.server";

const scope = (subject: string): QuizScope => ({ board: "UP Board", className: "10", subject, topic: "", difficulty: "medium", language: "en" });
const baseCfg = (p: Partial<QuizAutogenConfig> = {}): QuizAutogenConfig => parseQuizAutogenConfig({ enabled: true, questionCount: 5, scopes: [scope("Science"), scope("Maths")], ...p });
const TOPICS = ["velocity", "acceleration", "displacement", "friction", "momentum", "inertia", "gravity", "pressure", "density", "work", "energy", "power"];
const goodQ = (i: number) => ({ question: `Which statement correctly describes ${TOPICS[i % TOPICS.length]} in uniform circular motion number ${i}?`, options: [`A${i}`, `B${i}`, `C${i}`, `D${i}`], correct_index: i % 4, explanation: `Because option ${i} follows the definition.`, topic: "Motion" });
const batch = (n: number) => ({ questions: Array.from({ length: n }, (_, i) => goodQ(i)) });

function memoryStore(cfg: QuizAutogenConfig) {
  const runs = new Map<string, { status: string; attempts: number; updated: number }>();
  const contests: Array<{ slotKey: string; title: string; publish: boolean; questions: GeneratedQuestion[]; startsAt: Date; endsAt: Date }> = [];
  const store: QuizAutogenStore = {
    async getConfig() { return cfg; },
    async claimRun(slotKey, _s, maxAttempts, now): Promise<ClaimResult> {
      const r = runs.get(slotKey);
      if (!r) { runs.set(slotKey, { status: "running", attempts: 1, updated: now.getTime() }); return { state: "claimed", attempts: 1 }; }
      if (r.status === "succeeded") return { state: "done" };
      if (r.status === "running" && now.getTime() - r.updated < 600_000) return { state: "busy" };
      if (r.attempts >= maxAttempts) return { state: "exhausted" };
      r.attempts += 1; r.status = "running"; r.updated = now.getTime();
      return { state: "claimed", attempts: r.attempts };
    },
    async createContest(i) { contests.push({ slotKey: i.slotKey, title: i.title, publish: i.publish, questions: i.questions, startsAt: i.startsAt, endsAt: i.endsAt }); return { contestId: `c${contests.length}` }; },
    async finishRun(slotKey, patch) { const r = runs.get(slotKey)!; r.status = patch.status; },
  };
  return { store, runs, contests };
}

describe("config and slots", () => {
  it("defaults: off, 1-hour interval, 20 questions, 45 minutes, draft review", () => {
    const d = parseQuizAutogenConfig({});
    expect([d.enabled, d.intervalMinutes, d.questionCount, d.durationMinutes, d.publishMode]).toEqual([false, 60, 20, 45, "draft"]);
  });
  it("rejects out-of-range or unknown settings on the server schema", () => {
    expect(quizAutogenConfigSchema.safeParse({ intervalMinutes: 1 }).success).toBe(false);
    expect(quizAutogenConfigSchema.safeParse({ entryFee: 50 }).success).toBe(false); // no paid contests
    expect(quizAutogenConfigSchema.safeParse({ scopes: [{ board: "X", className: "9", subject: "Sci" }] }).success).toBe(false);
  });
  it("derives the slot from the configured interval only, and rotates scopes", () => {
    const cfg = baseCfg({ intervalMinutes: 60 });
    const a = computeSlot(new Date("2026-10-19T10:05:00Z"), cfg);
    const b = computeSlot(new Date("2026-10-19T10:55:00Z"), cfg);
    const c = computeSlot(new Date("2026-10-19T11:01:00Z"), cfg);
    expect(a.key).toBe(b.key);
    expect(c.key).not.toBe(a.key);
    expect(a.scope?.subject).not.toBe(c.scope?.subject);
    expect(computeSlot(new Date("2026-10-19T10:05:00Z"), baseCfg({ intervalMinutes: 30 })).key).not.toBe(a.key);
  });
  it("never creates an already-expired contest on a late tick", () => {
    const cfg = baseCfg({ startsAfterMinutes: 0 });
    const now = new Date("2026-10-19T10:50:00Z");
    const w = contestWindow(now, computeSlot(now, cfg), cfg);
    expect(w.startsAt.getTime()).toBeGreaterThan(now.getTime());
    expect(w.endsAt.getTime()).toBeGreaterThan(w.startsAt.getTime());
  });
});

describe("question validation", () => {
  const ctx = { subject: "Science", topic: "Motion", difficulty: "medium" };
  it("accepts well-formed questions and rejects broken ones with reasons", () => {
    const bad = [
      { ...goodQ(1), options: ["a", "b", "c"] },
      { ...goodQ(2), correct_index: 7 },
      { ...goodQ(3), correct_index: undefined },
      { ...goodQ(4), options: ["Same", "same", "C", "D"] },
      { ...goodQ(5), options: ["A", "B", "C", "All of the above"] },
      { ...goodQ(6), explanation: "" },
      { ...goodQ(7), topic: "Cricket history" },
      "nonsense",
    ];
    const r = validateGeneratedQuestions([goodQ(0), ...bad], ctx);
    expect(r.valid).toHaveLength(1);
    expect(r.rejected.map((x) => x.reason)).toEqual(expect.arrayContaining(["needs exactly 4 non-empty options", "missing or invalid correct answer", "duplicate options", "ambiguous option", "missing explanation", "outside the selected topic", "not an object"]));
  });
  it("drops duplicate and near-duplicate questions", () => {
    const r = validateGeneratedQuestions([goodQ(1), goodQ(1), { ...goodQ(1), options: ["w", "x", "y", "z"] }], ctx);
    expect(r.valid).toHaveLength(1);
  });
});

describe("runner: idempotency, retries and safety", () => {
  const now = new Date("2026-10-19T10:05:00Z");
  it("does nothing when disabled or when no scopes are configured", async () => {
    const off = memoryStore(baseCfg({ enabled: false }));
    expect((await runQuizAutogen({ store: off.store, generate: async () => batch(10), now })).status).toBe("disabled");
    const none = memoryStore(baseCfg({ scopes: [] }));
    expect((await runQuizAutogen({ store: none.store, generate: async () => batch(10), now })).status).toBe("no_scopes");
  });
  it("creates one contest per slot even when the job runs twice or retries", async () => {
    const m = memoryStore(baseCfg());
    const gen = vi.fn(async () => batch(10));
    const first = await runQuizAutogen({ store: m.store, generate: gen, now });
    const second = await runQuizAutogen({ store: m.store, generate: gen, now: new Date(now.getTime() + 60_000) });
    expect(first.status).toBe("created");
    expect(second.status).toBe("already_done");
    expect(m.contests).toHaveLength(1);
    expect(gen).toHaveBeenCalledTimes(1);
    expect(m.contests[0]?.questions).toHaveLength(5);
  });
  it("saves as draft by default and publishes only when configured", async () => {
    const draft = memoryStore(baseCfg());
    await runQuizAutogen({ store: draft.store, generate: async () => batch(10), now });
    expect(draft.contests[0]?.publish).toBe(false);
    const auto = memoryStore(baseCfg({ publishMode: "auto" }));
    await runQuizAutogen({ store: auto.store, generate: async () => batch(10), now });
    expect(auto.contests[0]?.publish).toBe(true);
  });
  it("never publishes an incomplete contest: too few valid questions fails and is logged", async () => {
    const m = memoryStore(baseCfg({ publishMode: "auto" }));
    const r = await runQuizAutogen({ store: m.store, generate: async () => batch(3), now });
    expect(r.status).toBe("failed");
    expect(m.contests).toHaveLength(0);
    expect(m.runs.get(computeSlot(now, baseCfg()).key)?.status).toBe("failed");
  });
  it("retries a failed slot up to the limit, then stops", async () => {
    const m = memoryStore(baseCfg({ maxAttempts: 2 }));
    const bad = async () => { throw new Error("AI took too long"); };
    expect((await runQuizAutogen({ store: m.store, generate: bad, now })).status).toBe("failed");
    expect((await runQuizAutogen({ store: m.store, generate: bad, now })).status).toBe("failed");
    expect((await runQuizAutogen({ store: m.store, generate: bad, now })).status).toBe("exhausted");
    const ok = memoryStore(baseCfg({ maxAttempts: 3 }));
    await runQuizAutogen({ store: ok.store, generate: bad, now });
    expect((await runQuizAutogen({ store: ok.store, generate: async () => batch(10), now })).status).toBe("created");
  });
  it("skips a slot that another worker is already running", async () => {
    const m = memoryStore(baseCfg());
    m.runs.set(computeSlot(now, baseCfg()).key, { status: "running", attempts: 1, updated: now.getTime() });
    expect((await runQuizAutogen({ store: m.store, generate: async () => batch(10), now })).status).toBe("busy");
  });
});
