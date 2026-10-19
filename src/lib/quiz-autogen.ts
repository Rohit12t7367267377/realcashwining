import { z } from "zod";
import { dedupeQuestions } from "@/lib/lesson-sections";

/**
 * Automatic school quiz-contest generation: pure logic (config, time slots, scope choice, question validation).
 * Generated contests are always FREE (no entry fee, no cash prize): paid contests stay disabled until the
 * legal/payment review is done. Everything here is deterministic and unit-tested.
 */
export const scopeSchema = z.object({
  board: z.string().trim().min(2).max(60),
  className: z.enum(["10", "11", "12"]),
  subject: z.string().trim().min(2).max(80),
  topic: z.string().trim().max(120).default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  language: z.enum(["en", "hi"]).default("en"),
});
export type QuizScope = z.infer<typeof scopeSchema>;

export const quizAutogenConfigSchema = z.object({
  enabled: z.boolean().default(false),
  intervalMinutes: z.number().int().min(15).max(1440).default(60),
  /** "draft": an admin reviews and publishes. "auto": publishes right after validation. */
  publishMode: z.enum(["draft", "auto"]).default("draft"),
  questionCount: z.number().int().min(5).max(50).default(20),
  durationMinutes: z.number().int().min(5).max(180).default(45),
  maxParticipants: z.number().int().min(2).max(100000).default(1000),
  startsAfterMinutes: z.number().int().min(0).max(1440).default(30),
  openForMinutes: z.number().int().min(15).max(10080).default(180),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  scopes: z.array(scopeSchema).max(60).default([]),
}).strict();
export type QuizAutogenConfig = z.infer<typeof quizAutogenConfigSchema>;

export const QUIZ_AUTOGEN_SETTING_KEY = "quiz_autogen";
export const DEFAULT_QUIZ_AUTOGEN: QuizAutogenConfig = quizAutogenConfigSchema.parse({});

export function parseQuizAutogenConfig(value: unknown): QuizAutogenConfig {
  const r = quizAutogenConfigSchema.safeParse(value);
  return r.success ? r.data : { ...DEFAULT_QUIZ_AUTOGEN };
}

export type Slot = { index: number; key: string; start: Date; scope: QuizScope | null };

/** The current schedule slot. The interval lives only in the config; nothing else hard-codes it. */
export function computeSlot(now: Date, cfg: QuizAutogenConfig): Slot {
  const ms = cfg.intervalMinutes * 60_000;
  const index = Math.floor(now.getTime() / ms);
  const scope = cfg.scopes.length ? (cfg.scopes[index % cfg.scopes.length] ?? null) : null;
  return { index, key: `school:${cfg.intervalMinutes}:${index}`, start: new Date(index * ms), scope };
}

/** Contest window. A late tick never creates an already-expired contest. */
export function contestWindow(now: Date, slot: Slot, cfg: QuizAutogenConfig) {
  const earliest = now.getTime() + 5 * 60_000;
  const starts = Math.max(slot.start.getTime() + cfg.startsAfterMinutes * 60_000, earliest);
  return { startsAt: new Date(starts), endsAt: new Date(starts + cfg.openForMinutes * 60_000) };
}

export function contestTitle(scope: QuizScope, startsAt: Date) {
  const when = startsAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
  return `${scope.board} Class ${scope.className} ${scope.subject}${scope.topic ? ` — ${scope.topic}` : ""} Quiz · ${when}`.slice(0, 160);
}

export type GeneratedQuestion = {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: string;
  topic: string;
};

const AMBIGUOUS = /(all|none) of the (above|these)|both (a|b|\(a\)|\(b\)) and|any of the above/i;
const words = (s: string) => new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));

/**
 * Rejects malformed, duplicate, ambiguous and off-topic questions. Topic relevance can only be checked
 * against the model's own `topic` label here, so the default publish mode stays "draft" for human review.
 */
export function validateGeneratedQuestions(raw: unknown, ctx: { subject: string; topic: string; difficulty: string }) {
  const list = Array.isArray(raw) ? raw : [];
  const accepted: GeneratedQuestion[] = [];
  const rejected: { index: number; reason: string }[] = [];
  const expected = words(`${ctx.topic} ${ctx.topic ? "" : ctx.subject}`);
  list.forEach((item, index) => {
    const reject = (reason: string) => rejected.push({ index, reason });
    if (!item || typeof item !== "object") return reject("not an object");
    const o = item as Record<string, unknown>;
    const question = String(o.question ?? "").trim();
    if (question.length < 15 || question.length > 400) return reject("question text length");
    const options = Array.isArray(o.options) ? o.options.map((x) => String(x ?? "").trim()) : [];
    if (options.length !== 4 || options.some((x) => !x || x.length > 200)) return reject("needs exactly 4 non-empty options");
    if (new Set(options.map((x) => x.toLowerCase())).size !== 4) return reject("duplicate options");
    if (options.some((x) => AMBIGUOUS.test(x))) return reject("ambiguous option");
    const ci = o.correct_index;
    if (typeof ci !== "number" || !Number.isInteger(ci) || ci < 0 || ci > 3) return reject("missing or invalid correct answer");
    const explanation = String(o.explanation ?? "").trim();
    if (explanation.length < 15) return reject("missing explanation");
    const topic = String(o.topic ?? "").trim();
    if (ctx.topic) {
      const got = words(topic);
      const hit = [...expected].some((w) => got.has(w));
      if (!hit) return reject("outside the selected topic");
    }
    accepted.push({ question, options, correct_index: ci, explanation: explanation.slice(0, 600), difficulty: ctx.difficulty, topic: topic.slice(0, 120) });
  });
  const unique = dedupeQuestions(accepted.map((q) => ({ ...q, prompt: q.question })), []);
  const valid: GeneratedQuestion[] = unique.map(({ prompt: _prompt, ...q }) => q);
  const dropped = accepted.length - valid.length;
  if (dropped > 0) rejected.push({ index: -1, reason: `${dropped} duplicate or near-duplicate question(s)` });
  return { valid, rejected };
}
