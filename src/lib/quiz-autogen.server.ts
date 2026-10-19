/**
 * Automatic school quiz-contest generation (server-only). Runs from the cron hook or the admin "Run now"
 * button. Idempotent and safe to retry: one contest per slot (unique slot key), failures are logged with a
 * bounded retry count, and an incomplete or invalid contest is never published.
 */
import {
  computeSlot, contestTitle, contestWindow, parseQuizAutogenConfig, validateGeneratedQuestions,
  QUIZ_AUTOGEN_SETTING_KEY, type GeneratedQuestion, type QuizAutogenConfig, type QuizScope,
} from "@/lib/quiz-autogen";

export type ClaimResult = { state: "claimed"; attempts: number } | { state: "done" } | { state: "busy" } | { state: "exhausted" };

export interface QuizAutogenStore {
  getConfig(): Promise<QuizAutogenConfig>;
  claimRun(slotKey: string, scope: QuizScope, maxAttempts: number, now: Date): Promise<ClaimResult>;
  createContest(input: {
    slotKey: string; scope: QuizScope; title: string; questions: GeneratedQuestion[];
    startsAt: Date; endsAt: Date; publish: boolean; cfg: QuizAutogenConfig;
  }): Promise<{ contestId: string }>;
  finishRun(slotKey: string, patch: { status: "succeeded" | "failed" | "skipped"; error?: string | null; contestId?: string | null; questionCount?: number | null }): Promise<void>;
}

export type Generator = (scope: QuizScope, count: number) => Promise<unknown>;

export type AutogenResult =
  | { status: "disabled" | "no_scopes" | "already_done" | "busy" | "exhausted"; slotKey?: string }
  | { status: "created"; slotKey: string; contestId: string; published: boolean; questions: number }
  | { status: "failed"; slotKey: string; error: string };

export async function runQuizAutogen(deps: { store: QuizAutogenStore; generate: Generator; now?: Date; force?: boolean }): Promise<AutogenResult> {
  const now = deps.now ?? new Date();
  const cfg = await deps.store.getConfig();
  if (!cfg.enabled && !deps.force) return { status: "disabled" };
  const slot = computeSlot(now, cfg);
  if (!slot.scope) return { status: "no_scopes" };
  const claim = await deps.store.claimRun(slot.key, slot.scope, cfg.maxAttempts, now);
  if (claim.state === "done") return { status: "already_done", slotKey: slot.key };
  if (claim.state === "busy") return { status: "busy", slotKey: slot.key };
  if (claim.state === "exhausted") return { status: "exhausted", slotKey: slot.key };

  try {
    // Ask for a few extra so a rejected question does not sink the whole contest.
    const raw = await deps.generate(slot.scope, cfg.questionCount + 5);
    const list = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as { questions?: unknown }).questions : raw;
    const { valid, rejected } = validateGeneratedQuestions(list, { subject: slot.scope.subject, topic: slot.scope.topic, difficulty: slot.scope.difficulty });
    if (valid.length < cfg.questionCount) {
      throw new Error(`Only ${valid.length} of ${cfg.questionCount} questions passed validation (${rejected.slice(0, 3).map((r) => r.reason).join("; ") || "too few returned"}).`);
    }
    const win = contestWindow(now, slot, cfg);
    const { contestId } = await deps.store.createContest({
      slotKey: slot.key, scope: slot.scope, title: contestTitle(slot.scope, win.startsAt),
      questions: valid.slice(0, cfg.questionCount), startsAt: win.startsAt, endsAt: win.endsAt,
      publish: cfg.publishMode === "auto", cfg,
    });
    await deps.store.finishRun(slot.key, { status: "succeeded", contestId, questionCount: cfg.questionCount, error: null });
    return { status: "created", slotKey: slot.key, contestId, published: cfg.publishMode === "auto", questions: cfg.questionCount };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Generation failed";
    await deps.store.finishRun(slot.key, { status: "failed", error: error.slice(0, 500) });
    return { status: "failed", slotKey: slot.key, error };
  }
}

/* ---------------------------- Supabase store ---------------------------- */
type Db = { from: (t: string) => any };

export function supabaseQuizAutogenStore(db: Db): QuizAutogenStore {
  const STALE_RUNNING_MS = 10 * 60_000;
  return {
    async getConfig() {
      const { data } = await db.from("app_settings").select("value").eq("key", QUIZ_AUTOGEN_SETTING_KEY).maybeSingle();
      return parseQuizAutogenConfig(data?.value);
    },
    async claimRun(slotKey, scope, maxAttempts, now) {
      const ins = await db.from("quiz_autogen_runs").insert({ slot_key: slotKey, scope, status: "running", attempts: 1 }).select("id").maybeSingle();
      if (!ins.error) return { state: "claimed", attempts: 1 };
      const { data: row } = await db.from("quiz_autogen_runs").select("status, attempts, updated_at").eq("slot_key", slotKey).maybeSingle();
      if (!row) return { state: "busy" };
      if (row.status === "succeeded" || row.status === "skipped") return { state: "done" };
      const stale = now.getTime() - new Date(row.updated_at).getTime() > STALE_RUNNING_MS;
      if (row.status === "running" && !stale) return { state: "busy" };
      if (row.attempts >= maxAttempts) return { state: "exhausted" };
      // Compare-and-set on attempts so two overlapping ticks cannot both take the retry.
      const upd = await db.from("quiz_autogen_runs")
        .update({ status: "running", attempts: row.attempts + 1, error: null, updated_at: now.toISOString() })
        .eq("slot_key", slotKey).eq("attempts", row.attempts).eq("status", row.status).select("attempts");
      return upd.data?.length ? { state: "claimed", attempts: row.attempts + 1 } : { state: "busy" };
    },
    async createContest({ slotKey, scope, title, questions, startsAt, endsAt, publish, cfg }) {
      // Each generated contest gets its own private category, so the existing play/score logic (which
      // reads a contest's questions by category) serves exactly these questions. It stays inactive so it
      // never appears in the public category list.
      const slug = `auto-${slotKey.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
      const cat = await db.from("categories").insert({ name: title.slice(0, 120), slug, active: false, description: "Auto-generated school quiz" }).select("id").single();
      if (cat.error) throw new Error(`Could not create the question set: ${cat.error.message}`);
      const categoryId = cat.data.id as string;
      try {
        const q = await db.from("questions").insert(questions.map((x) => ({
          category_id: categoryId, question: x.question, options: x.options, correct_index: x.correct_index,
          explanation: x.explanation, difficulty: x.difficulty,
        })));
        if (q.error) throw new Error(`Could not save questions: ${q.error.message}`);
        const c = await db.from("contests").insert({
          title, category_id: categoryId, entry_fee: 0, prize_pool: 0, first_prize: 0, contest_type: "free",
          duration_minutes: cfg.durationMinutes, num_questions: questions.length, max_participants: cfg.maxParticipants,
          active: publish, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
          auto_quiz: true, review_required: !publish, auto_slot_key: slotKey, auto_scope: scope,
        }).select("id").single();
        if (c.error) throw new Error(`Could not create the contest: ${c.error.message}`);
        return { contestId: c.data.id as string };
      } catch (e) {
        await db.from("categories").delete().eq("id", categoryId); // cascades to its questions: nothing half-built is left
        throw e;
      }
    },
    async finishRun(slotKey, patch) {
      await db.from("quiz_autogen_runs").update({
        status: patch.status, error: patch.error ?? null, contest_id: patch.contestId ?? null,
        question_count: patch.questionCount ?? null, updated_at: new Date().toISOString(),
      }).eq("slot_key", slotKey);
    },
  };
}

/** Real generator: the app's configured AI provider (same gateway as the classroom). Never invents answers locally. */
export async function aiQuizGenerator(scope: QuizScope, count: number): Promise<unknown> {
  const { callAiChat, extractJson } = await import("@/lib/ai-gateway.server");
  const raw = await callAiChat(
    [
      {
        role: "system",
        content: [
          "You write school exam multiple-choice questions. Accuracy matters more than cleverness.",
          `Board: ${scope.board}. Class: ${scope.className}. Subject: ${scope.subject}.${scope.topic ? ` Topic: ${scope.topic}.` : ""} Difficulty: ${scope.difficulty}.`,
          scope.language === "hi" ? "Write in simple Hindi (Devanagari)." : "Write in simple English.",
          `Write ${count} DIFFERENT questions that follow this class syllabus. Each must have exactly 4 options and exactly one unambiguously correct option. Do not use \"all of the above\" or \"none of the above\". Do not repeat concepts.`,
          'Return STRICT JSON only: {"questions":[{"question":"...","options":["A","B","C","D"],"correct_index":0,"explanation":"why the answer is correct","topic":"the specific chapter/topic this question belongs to"}]}',
        ].join("\n"),
      },
      { role: "user", content: "Generate the questions now." },
    ],
    { temperature: 0.5, model: "google/gemini-3.7-flash", responseFormat: "json_object", timeoutMs: 55_000 },
  );
  return extractJson(raw);
}
