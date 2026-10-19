import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeBoardBlocks } from "@/lib/guru-board-blocks";
import { lessonSegments } from "@/lib/lesson-segments";

const MODES = [
  "start",
  "again",
  "easier",
  "harder",
  "deeper",
  "example",
  "ask_me",
  "practice",
  "test",
  "doubt",
  "next",
] as const;

const turnInput = z.object({
  topic: z.string().trim().min(2).max(300),
  mode: z.enum(MODES).default("start"),
  level: z.number().int().min(1).max(5).default(3),
  studentText: z.string().trim().max(1200).optional(),
  context: z.string().trim().max(1500).optional(),
  history: z
    .array(z.object({ role: z.enum(["teacher", "student"]), content: z.string().max(1200) }))
    .max(12)
    .optional(),
});

async function teacherProfile(supabase: {
  from: (t: string) => any;
}, userId: string) {
  const { data: row } = await supabase
    .from("guru_student_xp")
    .select("preferred_language, selected_character_id, xp, questions_solved, lessons_completed, level, classroom_preferences")
    .eq("user_id", userId)
    .maybeSingle();
  const language = row?.preferred_language === "hi" ? "hi" : "en";
  const { data: character } = row?.selected_character_id
    ? await supabase
        .from("guru_characters")
        .select("name, teaching_style, tone")
        .eq("id", row.selected_character_id)
        .maybeSingle()
    : { data: null };
  const { parseClassroomPreferences } = await import("@/lib/classroom-preferences");
  const provider = parseClassroomPreferences(row?.classroom_preferences).aiModel === "openai" ? ("openai" as const) : undefined;
  return { language, character, stats: row ?? null, provider };
}

/** One turn of the interactive AI classroom lesson: speech + board + optional question. */
export const guruClassroomTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => turnInput.parse(d))
  .handler(async ({ context, data }) => {
    const { resolveTeachingContext, runTeachTurn } = await import("@/lib/guru-engine.server");
    const ctx = { scope: "classroom" as const, topic: data.topic, material: data.context };
    const resolved = await resolveTeachingContext(context.supabase as never, context.userId, ctx);
    if (resolved.premium) {
      const { requirePremiumMembership } = await import("@/lib/premium-access.server");
      await requirePremiumMembership(context.supabase, context.userId);
    }
    const turn = await runTeachTurn({ ctx, resolved, mode: data.mode, level: data.level, studentText: data.studentText, history: data.history });
    return { ...turn, level: data.level, mode: data.mode, language: resolved.language, teacher: resolved.teacher.name };
  });

/** Evaluates the student's answer, detects misunderstanding and adapts difficulty. */
export const guruEvaluateAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        topic: z.string().trim().min(2).max(300),
        question: z.string().trim().min(2).max(600),
        expected: z.string().trim().max(600).optional(),
        answer: z.string().trim().min(1).max(1200),
        level: z.number().int().min(1).max(5).default(3),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { callAiChat, extractJson } = await import("@/lib/ai-gateway.server");
    const { language, character, provider } = await teacherProfile(context.supabase, context.userId);

    const raw = await callAiChat(
      [
        {
          role: "system",
          content: [
            "You are a supportive 2D classroom teacher grading one spoken/typed student answer.",
            language === "hi" ? "Reply in simple Hindi (Devanagari)." : "Reply in simple English.",
            "Return STRICT JSON only:",
            '{"verdict":"correct|partial|wrong","score":0-100,"misunderstanding":"what the student got wrong or null","feedback":"1-2 sentences","speech":"what you say aloud (40-90 words)","reteach":true|false,"levelChange":-1|0|1,"board":[block,...]}',
            "board: 1-3 blocks correcting or reinforcing the idea (same block schema as lessons: heading/text/formula/steps/example/code/table/diagram).",
            "reteach: true when the student clearly misunderstood the concept.",
            "levelChange: +1 if the answer was easy for them, -1 if they struggled, else 0.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `Topic: ${data.topic}`,
            `Question: ${data.question}`,
            data.expected ? `Ideal answer: ${data.expected}` : "",
            `Student answer: ${data.answer}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      { temperature: 0.3, model: "google/gemini-3.7-flash", responseFormat: "json_object", provider },
    );

    const p = (extractJson(raw) ?? {}) as Record<string, unknown>;
    const verdict = ["correct", "partial", "wrong"].includes(String(p.verdict)) ? String(p.verdict) : "partial";
    const score = Math.max(0, Math.min(100, Number(p.score ?? (verdict === "correct" ? 100 : verdict === "partial" ? 50 : 0))));
    const change = Number(p.levelChange);
    const levelChange = change === 1 || change === -1 ? change : 0;

    const correctionBoard = normalizeBoardBlocks(p.board, 3);
    const displayedCorrection = correctionBoard.length ? correctionBoard : [{ type: "text" as const, text: String(p.feedback ?? "").slice(0, 400) }];
    const segments = lessonSegments(data.topic, displayedCorrection);
    return {
      verdict: verdict as "correct" | "partial" | "wrong",
      score,
      misunderstanding: p.misunderstanding ? String(p.misunderstanding).slice(0, 300) : null,
      feedback: String(p.feedback ?? "").slice(0, 400),
      speech: segments.map((segment) => segment.narration).join("\n\n"),
      segments,
      reteach: p.reteach === true || verdict === "wrong",
      nextLevel: Math.max(1, Math.min(5, data.level + levelChange)),
      board: displayedCorrection,
      teacher: character?.name ?? "Guru",
      language,
    };
  });

/** Saves classroom progress: XP, questions answered and lesson completion. */
export const guruClassroomProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        questions: z.number().int().min(0).max(100).default(0),
        correct: z.number().int().min(0).max(100).default(0),
        lessonCompleted: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { guruProgress } = await import("@/lib/guru.server");
    const { supabase, userId } = context;
    const xpEarned = data.correct * 8 + data.questions * 2 + (data.lessonCompleted ? 20 : 0);

    const { data: row } = await supabase
      .from("guru_student_xp")
      .select("xp, questions_solved, lessons_completed")
      .eq("user_id", userId)
      .maybeSingle();

    const newXp = Number(row?.xp ?? 0) + xpEarned;
    const { error } = await supabase.from("guru_student_xp").upsert(
      {
        user_id: userId,
        xp: newXp,
        level: guruProgress(newXp).level,
        questions_solved: Number(row?.questions_solved ?? 0) + data.questions,
        lessons_completed: Number(row?.lessons_completed ?? 0) + (data.lessonCompleted ? 1 : 0),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);

    return { xpEarned, xp: newXp, level: guruProgress(newXp).level };
  });

const sectionKinds = ["objectives","intro","concepts","theory","formulas","derivation","examples","numericals","mistakes","practice","recap","mastery"] as const;
const planItem = z.object({ kind: z.enum(sectionKinds), title: z.string().max(90), focus: z.string().max(300), required: z.boolean() });

async function classroomContext(context: { supabase: unknown; userId: string }, topic: string) {
  const { resolveTeachingContext } = await import("@/lib/guru-engine.server");
  const ctx = { scope: "classroom" as const, topic };
  const resolved = await resolveTeachingContext(context.supabase as never, context.userId, ctx);
  if (resolved.premium) {
    const { requirePremiumMembership } = await import("@/lib/premium-access.server");
    await requirePremiumMembership(context.supabase as never, context.userId);
  }
  return { ctx, resolved };
}

/** Textbook outline for a topic: which sections apply (required ones can never be dropped). */
export const guruLessonOutline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ topic: z.string().trim().min(2).max(300) }).parse(d))
  .handler(async ({ context, data }) => {
    const { runLessonOutline } = await import("@/lib/guru-engine.server");
    const { ctx, resolved } = await classroomContext(context, data.topic);
    const outline = await runLessonOutline({ ctx, resolved });
    return { ...outline, teacher: resolved.teacher.name, language: resolved.language };
  });

/** One textbook section per request, with context of earlier sections and optional continuation. */
export const guruLessonSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      topic: z.string().trim().min(2).max(300),
      level: z.number().int().min(1).max(5).default(3),
      plan: z.array(planItem).min(1).max(12),
      index: z.number().int().min(0).max(11),
      previous: z.string().max(3000).default(""),
      existing: z.array(z.record(z.string(), z.unknown())).max(14).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { runLessonSection } = await import("@/lib/guru-engine.server");
    const { normalizeBoardBlocks } = await import("@/lib/guru-board-blocks");
    const { ctx, resolved } = await classroomContext(context, data.topic);
    const result = await runLessonSection({
      ctx, resolved, level: data.level, plan: data.plan, index: data.index, previous: data.previous,
      existing: data.existing ? normalizeBoardBlocks(data.existing, 14) : undefined,
    });
    return { ...result, index: data.index };
  });

/** More topic-specific practice on demand. The only limits are model/infrastructure ones. */
export const guruPracticeSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      topic: z.string().trim().min(2).max(300),
      difficulty: z.enum(["basic", "intermediate", "advanced", "exam"]).default("intermediate"),
      kind: z.enum(["mixed", "numerical", "conceptual", "derivation"]).default("mixed"),
      count: z.number().int().min(1).max(5).default(3),
      avoid: z.array(z.string().max(700)).max(60).default([]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { runPracticeSet } = await import("@/lib/guru-engine.server");
    const { ctx, resolved } = await classroomContext(context, data.topic);
    const questions = await runPracticeSet({ ctx, resolved, difficulty: data.difficulty, kind: data.kind, count: data.count, avoid: data.avoid.slice(-30) });
    return { questions, requested: data.count };
  });
