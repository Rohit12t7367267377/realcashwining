// Server-only helpers for the Guru.AI world. No client imports.
import { callAiChat } from "@/lib/ai-gateway.server";

export const GURU_XP_PER_LEVEL = 250;

export function guruLevelForXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / GURU_XP_PER_LEVEL)) + 1);
}

export function guruLevelBounds(level: number) {
  const floor = Math.pow(level - 1, 2) * GURU_XP_PER_LEVEL;
  const next = Math.pow(level, 2) * GURU_XP_PER_LEVEL;
  return { floor, next };
}

export function guruProgress(xp: number) {
  const level = guruLevelForXp(xp);
  const { floor, next } = guruLevelBounds(level);
  const progress = Math.max(0, Math.min(1, (xp - floor) / Math.max(1, next - floor)));
  return { level, floor, next, progress };
}

export type UnlockStats = {
  lessons_completed: number;
  questions_solved: number;
  streak_days: number;
  chapters_mastered: number;
  coding_challenges: number;
  competitions: number;
  competitions_won: number;
};

/** A requirement is met when every numeric key in it is satisfied by the stats. */
export function isUnlocked(requirement: unknown, stats: Partial<UnlockStats>): boolean {
  if (!requirement || typeof requirement !== "object") return true;
  const req = requirement as Record<string, unknown>;
  const keys = Object.keys(req);
  if (keys.length === 0) return true;
  return keys.every((k) => {
    const need = Number(req[k] ?? 0);
    const have = Number((stats as Record<string, unknown>)[k] ?? 0);
    return have >= need;
  });
}

export function describeRequirement(requirement: unknown): string {
  if (!requirement || typeof requirement !== "object") return "Available now";
  const req = requirement as Record<string, unknown>;
  const labels: Record<string, string> = {
    lessons_completed: "lessons completed",
    questions_solved: "questions solved",
    streak_days: "day learning streak",
    chapters_mastered: "chapters mastered",
    coding_challenges: "coding challenges",
    competitions: "competitions joined",
    competitions_won: "competitions won",
  };
  const parts = Object.entries(req).map(([k, v]) => `${v} ${labels[k] ?? k.replace(/_/g, " ")}`);
  return parts.length ? `Unlock by: ${parts.join(", ")}` : "Available now";
}

/** Streak roll-forward: same day = no change, yesterday = +1, older = reset to 1. */
export function nextStreak(lastActive: string | null, streak: number, todayIso: string) {
  if (!lastActive) return { streak: 1, changed: true };
  if (lastActive === todayIso) return { streak: Math.max(1, streak), changed: false };
  const last = new Date(lastActive + "T00:00:00Z").getTime();
  const today = new Date(todayIso + "T00:00:00Z").getTime();
  const days = Math.round((today - last) / 86_400_000);
  if (days === 1) return { streak: streak + 1, changed: true };
  return { streak: 1, changed: true };
}

export type TeachContext = {
  intent: "learn" | "doubt" | "simple" | "practice" | "quiz" | "revise" | "chat";
  question: string;
  language: string;
  character: { name: string; personality: string; teaching_style: string; tone: string } | null;
  topic?: { title: string; objectives: string[]; lesson?: string | null } | null;
  board?: string | null;
  className?: string | null;
  subject?: string | null;
};

const INTENT_DIRECTIVE: Record<TeachContext["intent"], string> = {
  learn: "Teach the topic from the very beginning, in small numbered steps, with everyday examples. End by asking whether the student understood.",
  doubt: "Answer the student's doubt using the current lesson context only. Be short and concrete, then invite a follow-up question.",
  simple: "Explain the topic in the simplest possible words, as if to a curious beginner. Use one analogy and one example.",
  practice: "Give 5 practice questions of rising difficulty with hints, then the worked answers.",
  quiz: "Give a 5-question multiple-choice quiz with 4 options each, then the answer key with one-line reasons.",
  revise: "Give a crisp revision sheet: key points, formulas/terms, and 3 common mistakes.",
  chat: "Answer helpfully and stay educational.",
};

export function buildTeachMessages(ctx: TeachContext) {
  const c = ctx.character;
  const persona = c
    ? `You are ${c.name}, an AI teacher character inside Guru.AI. Personality: ${c.personality}. Teaching style: ${c.teaching_style}. Tone: ${c.tone}. You are only a presenter — never invent facts; if unsure, say so.`
    : "You are a friendly AI teacher inside Guru.AI.";
  const level = [ctx.board, ctx.className, ctx.subject].filter(Boolean).join(" • ");
  const topic = ctx.topic
    ? `Current topic: ${ctx.topic.title}. Learning objectives: ${(ctx.topic.objectives || []).join("; ") || "n/a"}. Lesson notes: ${(ctx.topic.lesson || "").slice(0, 4000)}`
    : "No specific school topic is open; answer as a universal tutor.";
  const lang = ctx.language === "hi" ? "Reply in simple Hindi (Devanagari)." : "Reply in simple English.";
  return [
    {
      role: "system" as const,
      content: [
        persona,
        level ? `Student context: ${level}. Never assume knowledge above this level.` : "",
        topic,
        INTENT_DIRECTIVE[ctx.intent],
        lang,
        "Keep answers under 400 words unless asked for more. Use short paragraphs and bullet points.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
    { role: "user" as const, content: ctx.question },
  ];
}

/**
 * Integration-ready boundary: swap this for a RAG pipeline later.
 * Falls back to a helpful offline reply when no AI provider is configured.
 */
export async function guruTeach(ctx: TeachContext): Promise<{ content: string; provider: string }> {
  if (!process.env.LOVABLE_API_KEY) {
    const t = ctx.topic?.title ?? "this topic";
    return {
      provider: "offline",
      content:
        `Guru.AI's teaching engine is not connected yet, so here is your study outline for ${t}:\n\n` +
        `1. Read the learning objectives above.\n2. Note down every new term.\n3. Try the practice questions.\n4. Revise after a day.\n\n` +
        `Once an AI provider is configured, ${ctx.character?.name ?? "your character"} will explain this step by step in your language.`,
    };
  }
  const content = await callAiChat(buildTeachMessages(ctx), { temperature: 0.4 });
  return { content, provider: "lovable-ai" };
}

export type GuruQuestion = {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
};

/** Generate a topic mastery test. Returns [] when no AI provider is configured. */
export async function guruGenerateQuestions(args: {
  topic: string;
  objectives: string[];
  board?: string | null;
  className?: string | null;
  subject?: string | null;
  lesson?: string | null;
  language: string;
  count: number;
}): Promise<GuruQuestion[]> {
  if (!process.env.LOVABLE_API_KEY) return [];
  const { extractJson } = await import("@/lib/ai-gateway.server");
  const raw = await callAiChat(
    [
      {
        role: "system",
        content:
          `You write school assessment questions. Student level: ${[args.board, args.className, args.subject].filter(Boolean).join(" • ") || "school"}. ` +
          `${args.language === "hi" ? "Write everything in simple Hindi (Devanagari)." : "Write everything in simple English."} ` +
          `Return ONLY JSON of the shape {"questions":[{"question":string,"options":[4 strings],"correct_index":0-3,"explanation":string,"difficulty":"easy"|"medium"|"hard"}]}. ` +
          `Never invent facts outside the topic.`,
      },
      {
        role: "user",
        content:
          `Topic: ${args.topic}\nObjectives: ${(args.objectives || []).join("; ") || "n/a"}\n` +
          `Lesson notes: ${(args.lesson || "").slice(0, 3000)}\nMake ${args.count} questions of rising difficulty.`,
      },
    ],
    { temperature: 0.5, responseFormat: "json_object" },
  );
  const parsed = extractJson(raw) as { questions?: unknown };
  const list = Array.isArray(parsed?.questions) ? (parsed.questions as Record<string, unknown>[]) : [];
  return list
    .map((q) => {
      const options = Array.isArray(q.options) ? q.options.map((o) => String(o)).filter((o) => o.trim()) : [];
      const ci = Number(q.correct_index ?? 0);
      return {
        question: String(q.question ?? "").trim(),
        options,
        correct_index: ci >= 0 && ci < options.length ? ci : 0,
        explanation: String(q.explanation ?? "").trim(),
        difficulty: (["easy", "medium", "hard"].includes(String(q.difficulty)) ? String(q.difficulty) : "medium") as GuruQuestion["difficulty"],
      };
    })
    .filter((q) => q.question && q.options.length >= 2)
    .slice(0, args.count);
}
