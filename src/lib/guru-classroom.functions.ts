import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeBoardBlocks } from "@/lib/guru-board-blocks";

const MODES = [
  "start",
  "again",
  "easier",
  "harder",
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

const MODE_BRIEF: Record<(typeof MODES)[number], string> = {
  start: "Begin the lesson: hook the student, then explain the first step clearly.",
  again: "Re-explain the SAME step differently and more slowly — the student did not understand.",
  easier: "Explain far more simply, with everyday language and a tiny relatable analogy.",
  harder: "Go one level deeper with a more advanced treatment of the same topic.",
  example: "Teach through a fully solved example, showing every step on the board.",
  ask_me: "Ask the student ONE question to check understanding. Keep the board short.",
  practice: "Give 2-3 short practice problems on the board, then ask the first one.",
  test: "Give a mini-test question worth checking mastery, one question at a time.",
  doubt: "Answer the student's doubt precisely, then continue teaching the topic.",
  next: "Continue the lesson from where you stopped with the next step.",
};

async function teacherProfile(supabase: {
  from: (t: string) => any;
}, userId: string) {
  const { data: row } = await supabase
    .from("guru_student_xp")
    .select("preferred_language, selected_character_id, xp, questions_solved, lessons_completed, level")
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
  return { language, character, stats: row ?? null };
}

function systemPrompt(args: {
  language: string;
  character: { name?: string; teaching_style?: string | null; tone?: string | null } | null;
  level: number;
  mode: string;
}) {
  return [
    "You are a friendly 2D animated classroom teacher standing at an interactive digital board.",
    args.character?.name
      ? `Your name is ${args.character.name}. Teaching style: ${args.character.teaching_style ?? "clear"}. Tone: ${args.character.tone ?? "warm"}.`
      : "Your name is Guru.",
    args.language === "hi" ? "Speak and write in simple Hindi (Devanagari)." : "Speak and write in simple English.",
    `Student difficulty level: ${args.level} of 5 (1 = beginner, 5 = advanced). Match your depth to this level.`,
    `Task for this turn: ${MODE_BRIEF[args.mode as (typeof MODES)[number]] ?? MODE_BRIEF.next}`,
    "You fully control the board. Return STRICT JSON only:",
    '{"title":"short lesson title","speech":"what you say aloud","board":[block,...],"question":{"prompt":"...","hint":"...","expected":"ideal answer"}|null,"stepLabel":"e.g. Step 2 of 5","done":false}',
    "Board blocks (use 3-6 per turn, mix types where useful):",
    '{"type":"heading","text":"..."}',
    '{"type":"text","text":"...","highlight":true|false}',
    '{"type":"formula","text":"a^2 + b^2 = c^2","label":"Pythagoras"}',
    '{"type":"steps","title":"Solution","items":["step 1","step 2"]}',
    '{"type":"example","title":"Example","body":"..."}',
    '{"type":"code","language":"python","code":"..."}',
    '{"type":"table","columns":["A","B"],"rows":[["1","2"]]}',
    '{"type":"diagram","caption":"Water cycle","nodes":["Evaporation","Condensation","Rain"],"arrows":true}',
    "speech: 60-130 words, natural spoken classroom language, no markdown, no emojis, no asterisks.",
    "question: include a question whenever the mode asks for one, or naturally to check understanding; otherwise null.",
    "Never repeat the exact same wording as your previous turns.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** One turn of the interactive AI classroom lesson: speech + board + optional question. */
export const guruClassroomTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => turnInput.parse(d))
  .handler(async ({ context, data }) => {
    const { callAiChat, extractJson } = await import("@/lib/ai-gateway.server");
    const { language, character } = await teacherProfile(context.supabase, context.userId);

    const transcript = (data.history ?? [])
      .map((m) => `${m.role === "teacher" ? "Teacher" : "Student"}: ${m.content}`)
      .join("\n")
      .slice(-3000);

    const userParts = [
      `Topic: ${data.topic}`,
      data.context ? `Reference material:\n${data.context}` : "",
      transcript ? `Lesson so far:\n${transcript}` : "",
      data.studentText ? `Student says: ${data.studentText}` : "",
    ].filter(Boolean);

    const raw = await callAiChat(
      [
        { role: "system", content: systemPrompt({ language, character, level: data.level, mode: data.mode }) },
        { role: "user", content: userParts.join("\n\n") },
      ],
      { temperature: 0.6, model: "google/gemini-3.7-flash", responseFormat: "json_object" },
    );

    const parsed = (extractJson(raw) ?? {}) as Record<string, unknown>;
    const board = normalizeBoardBlocks(parsed.board);
    const q = parsed.question && typeof parsed.question === "object" ? (parsed.question as Record<string, unknown>) : null;
    const prompt = q ? String(q.prompt ?? "").trim() : "";

    return {
      title: String(parsed.title ?? data.topic).slice(0, 90),
      speech: String(parsed.speech ?? "").slice(0, 1800),
      board: board.length ? board : [{ type: "text" as const, text: String(parsed.speech ?? data.topic).slice(0, 300) }],
      question: prompt
        ? {
            prompt: prompt.slice(0, 400),
            hint: q?.hint ? String(q.hint).slice(0, 240) : null,
            expected: q?.expected ? String(q.expected).slice(0, 400) : null,
          }
        : null,
      stepLabel: parsed.stepLabel ? String(parsed.stepLabel).slice(0, 40) : null,
      done: parsed.done === true,
      level: data.level,
      mode: data.mode,
      language,
      teacher: character?.name ?? "Guru",
    };
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
    const { language, character } = await teacherProfile(context.supabase, context.userId);

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
      { temperature: 0.3, model: "google/gemini-3.7-flash", responseFormat: "json_object" },
    );

    const p = (extractJson(raw) ?? {}) as Record<string, unknown>;
    const verdict = ["correct", "partial", "wrong"].includes(String(p.verdict)) ? String(p.verdict) : "partial";
    const score = Math.max(0, Math.min(100, Number(p.score ?? (verdict === "correct" ? 100 : verdict === "partial" ? 50 : 0))));
    const change = Number(p.levelChange);
    const levelChange = change === 1 || change === -1 ? change : 0;

    return {
      verdict: verdict as "correct" | "partial" | "wrong",
      score,
      misunderstanding: p.misunderstanding ? String(p.misunderstanding).slice(0, 300) : null,
      feedback: String(p.feedback ?? "").slice(0, 400),
      speech: String(p.speech ?? p.feedback ?? "").slice(0, 900),
      reteach: p.reteach === true || verdict === "wrong",
      nextLevel: Math.max(1, Math.min(5, data.level + levelChange)),
      board: normalizeBoardBlocks(p.board, 3),
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
    await supabase.from("guru_student_xp").upsert(
      {
        user_id: userId,
        xp: newXp,
        level: guruProgress(newXp).level,
        questions_solved: Number(row?.questions_solved ?? 0) + data.questions,
        lessons_completed: Number(row?.lessons_completed ?? 0) + (data.lessonCompleted ? 1 : 0),
      },
      { onConflict: "user_id" },
    );

    return { xpEarned, xp: newXp, level: guruProgress(newXp).level };
  });
