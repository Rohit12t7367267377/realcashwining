/**
 * GURU.AI CENTRAL AI TEACHING ENGINE (server-only).
 *
 * One engine powers every education module: School, College, Competitive Exams,
 * Skills, Galaxy Classroom, Universal AI and My AI Character. Modules only pass
 * their context (scope + reference + topic); the engine resolves the AI teacher,
 * the admin teaching configuration, the student's level/language/voice, the
 * retrieved authorized knowledge, and produces a teaching turn
 * (speech + interactive board + question).
 */
import { callAiChat, extractJson } from "@/lib/ai-gateway.server";
import { retrieveGuruContext, formatSources } from "@/lib/guru-rag.server";
import { normalizeBoardBlocks } from "@/lib/guru-board-blocks";
import { teachingStyleDirective } from "@/lib/guru-teaching";

type Db = { from: (t: string) => any; rpc: (n: string, a?: unknown) => any };

export const TEACH_SCOPES = [
  "school",
  "college",
  "exam",
  "skill",
  "galaxy",
  "universal",
  "library",
  "classroom",
] as const;
export type TeachScope = (typeof TEACH_SCOPES)[number];

export const TEACH_MODES = [
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
  "revise",
  "next",
] as const;
export type TeachMode = (typeof TEACH_MODES)[number];

const MODE_BRIEF: Record<TeachMode, string> = {
  start: "Begin the lesson: introduce the topic, check the prerequisite in one line, then teach the first step.",
  again: "Re-explain the SAME step in a completely different way, slower — the student did not understand.",
  easier: "Explain far more simply, with everyday language and one tiny relatable analogy.",
  harder: "Raise the difficulty: a deeper, more advanced treatment of the same topic.",
  deeper:
    "Deep learning mode: intuition, definition, core concept, formula/derivation where relevant, diagram, worked example, real-world use, common mistakes.",
  example: "Teach through one fully solved example, every step shown on the board.",
  ask_me: "Ask the student exactly ONE question to check understanding. Keep the board short.",
  practice: "Put 2-3 short practice problems on the board, then ask the first one.",
  test: "Give one mini-test question that checks mastery.",
  doubt: "Answer the student's doubt precisely using the lesson context, then continue teaching.",
  revise: "Give a crisp revision summary: key points, formulas/terms, and 3 common mistakes.",
  next: "Continue the lesson from where you stopped with the next step.",
};

/** Subject-specific board/teaching tools. The engine picks by subject keywords. */
const SUBJECT_TOOLKITS: Array<{ match: RegExp; tools: string }> = [
  { match: /math|algebra|calculus|geometry|trigo|arithmet|statis/i, tools: "formula blocks, step-by-step calculations, graphs and geometry diagrams" },
  { match: /physic/i, tools: "free-body/diagram blocks, formulas, graphs and numerical steps" },
  { match: /chem/i, tools: "chemical equations, reaction-step blocks and structure descriptions" },
  { match: /bio|botan|zoolog/i, tools: "labelled diagrams, process flowcharts and comparison tables" },
  { match: /dsa|data structure|algorithm/i, tools: "array/tree/graph visual diagrams, algorithm steps, complexity tables and code blocks" },
  { match: /program|code|coding|python|java|javascript|c\+\+|dbms|sql/i, tools: "code blocks, dry-run tables, output prediction and debugging notes" },
  { match: /ai|machine learning|ml|data science|neural/i, tools: "math blocks, model diagrams, code blocks and data tables" },
  { match: /english|language|grammar|literature|hindi|sanskrit/i, tools: "example sentences, comparison tables and short dialogues" },
  { match: /history|civic|polit|geograph|economic/i, tools: "timelines, cause-effect flowcharts and comparison tables" },
];

function toolkitFor(subject?: string | null, topic?: string | null): string {
  const hay = `${subject ?? ""} ${topic ?? ""}`;
  const hit = SUBJECT_TOOLKITS.find((t) => t.match.test(hay));
  return hit?.tools ?? "headings, highlighted text, examples and comparison tables";
}

export type TeachingConfig = {
  id: string;
  title: string;
  character_id: string | null;
  voice_code: string | null;
  teaching_mode: string;
  board_type: string;
  tools: string[];
  lesson_structure: string[];
  difficulty: string | null;
  language: string;
  access: string;
  extra_instructions: string | null;
};

export type ResolvedTeacher = {
  characterId: string | null;
  name: string;
  emoji: string | null;
  avatarStyle: string | null;
  accentColor: string | null;
  personality: string | null;
  teachingStyle: string | null;
  tone: string | null;
  specialization: string | null;
  voice: {
    provider: string;
    voiceId: string;
    fallbackVoiceId: string | null;
    speed: number;
    label: string;
    code: string | null;
  };
};

export type TeachContextInput = {
  scope: TeachScope;
  /** Topic/unit/lesson row id when the module has one. */
  refId?: string | null;
  /** Free-text key used when the module has no row id (e.g. AI-generated topics). */
  topicKey?: string | null;
  topic: string;
  subject?: string | null;
  levelLabel?: string | null;
  /** Extra reference material the module already has (notes, question text, code). */
  material?: string | null;
};

export type ResolvedTeachingContext = {
  config: TeachingConfig | null;
  teacher: ResolvedTeacher;
  language: "en" | "hi";
  level: number;
  styleDirective: string;
  sources: string;
  toolkit: string;
  premium: boolean;
};

const DEFAULT_VOICE = { provider: "lovable", voiceId: "alloy", speed: 1, label: "Alloy", code: "alloy" };

async function loadVoice(db: Db, code: string | null | undefined) {
  if (!code) return null;
  const { data } = await db.from("guru_voices").select("*").eq("code", code).eq("active", true).maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

/** Pick the admin teaching configuration that best matches this context. */
export async function resolveTeachingConfig(db: Db, ctx: TeachContextInput): Promise<TeachingConfig | null> {
  const rows: Record<string, unknown>[] = [];
  if (ctx.refId) {
    const { data } = await db
      .from("guru_teaching_configs")
      .select("*")
      .eq("active", true)
      .eq("scope", ctx.scope)
      .eq("ref_id", ctx.refId)
      .order("priority", { ascending: false })
      .limit(1);
    if (Array.isArray(data)) rows.push(...(data as Record<string, unknown>[]));
  }
  if (rows.length === 0) {
    const key = (ctx.topicKey ?? ctx.topic).trim().toLowerCase();
    if (key) {
      const { data } = await db
        .from("guru_teaching_configs")
        .select("*")
        .eq("active", true)
        .eq("scope", ctx.scope)
        .ilike("topic_key", key)
        .order("priority", { ascending: false })
        .limit(1);
      if (Array.isArray(data)) rows.push(...(data as Record<string, unknown>[]));
    }
  }
  const row = rows[0];
  if (!row) return null;
  const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)) : []);
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    character_id: (row.character_id as string | null) ?? null,
    voice_code: (row.voice_code as string | null) ?? null,
    teaching_mode: String(row.teaching_mode ?? "interactive"),
    board_type: String(row.board_type ?? "whiteboard"),
    tools: arr(row.tools),
    lesson_structure: arr(row.lesson_structure),
    difficulty: (row.difficulty as string | null) ?? null,
    language: String(row.language ?? "en"),
    access: String(row.access ?? "free"),
    extra_instructions: (row.extra_instructions as string | null) ?? null,
  };
}

/** Choose the teacher: admin config > student's selected character > subject specialist > general. */
async function resolveTeacher(
  db: Db,
  args: { configCharacterId?: string | null; studentCharacterId?: string | null; subject?: string | null; voiceOverride?: string | null; speedOverride?: number | null },
): Promise<ResolvedTeacher> {
  const pick = async (id?: string | null) => {
    if (!id) return null;
    const { data } = await db.from("guru_characters").select("*").eq("id", id).maybeSingle();
    return (data as Record<string, unknown> | null) ?? null;
  };

  let row = (await pick(args.configCharacterId)) ?? (await pick(args.studentCharacterId));

  if (!row && args.subject) {
    const { data } = await db
      .from("guru_characters")
      .select("*")
      .eq("active", true)
      .ilike("subject_specialization", `%${args.subject.split(/[^a-zA-Z]+/)[0] ?? args.subject}%`)
      .order("sort_order")
      .limit(1);
    row = Array.isArray(data) && data.length ? (data[0] as Record<string, unknown>) : null;
  }
  if (!row) {
    const { data } = await db
      .from("guru_characters")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .limit(1);
    row = Array.isArray(data) && data.length ? (data[0] as Record<string, unknown>) : null;
  }

  const voiceRow =
    (await loadVoice(db, args.voiceOverride)) ??
    (await loadVoice(db, (row?.voice_code as string | null) ?? null)) ??
    (await loadVoice(db, (row?.fallback_voice_code as string | null) ?? null));
  const fallbackRow = await loadVoice(db, (row?.fallback_voice_code as string | null) ?? "alloy");

  return {
    characterId: row ? String(row.id) : null,
    name: row ? String(row.name) : "Guru",
    emoji: (row?.emoji as string | null) ?? null,
    avatarStyle: (row?.avatar_style as string | null) ?? null,
    accentColor: (row?.accent_color as string | null) ?? null,
    personality: (row?.personality as string | null) ?? null,
    teachingStyle: (row?.teaching_style as string | null) ?? null,
    tone: (row?.tone as string | null) ?? null,
    specialization: (row?.subject_specialization as string | null) ?? null,
    voice: voiceRow
      ? {
          provider: String(voiceRow.provider ?? "lovable"),
          voiceId: String(voiceRow.voice_id ?? "alloy"),
          fallbackVoiceId: fallbackRow ? String(fallbackRow.voice_id) : "alloy",
          speed: Number(args.speedOverride ?? row?.voice_speed ?? voiceRow.speed ?? 1) || 1,
          label: String(voiceRow.label ?? "Voice"),
          code: String(voiceRow.code ?? ""),
        }
      : { ...DEFAULT_VOICE, fallbackVoiceId: "alloy", speed: Number(args.speedOverride ?? 1) || 1 },
  };
}

/** Full context resolution: teacher, config, language, level, style, retrieved knowledge. */
export async function resolveTeachingContext(
  db: Db,
  userId: string,
  ctx: TeachContextInput,
): Promise<ResolvedTeachingContext> {
  const [{ data: student }, config] = await Promise.all([
    db
      .from("guru_student_xp")
      .select("preferred_language, selected_character_id, preferred_teaching_style, preferred_voice_code, preferred_voice_speed, level")
      .eq("user_id", userId)
      .maybeSingle(),
    resolveTeachingConfig(db, ctx),
  ]);

  const s = (student as Record<string, unknown> | null) ?? null;
  const language = (config?.language === "hi" || s?.preferred_language === "hi" ? "hi" : "en") as "en" | "hi";
  const teacher = await resolveTeacher(db, {
    configCharacterId: config?.character_id ?? null,
    studentCharacterId: (s?.selected_character_id as string | null) ?? null,
    subject: ctx.subject ?? null,
    voiceOverride: (s?.preferred_voice_code as string | null) ?? config?.voice_code ?? null,
    speedOverride: s?.preferred_voice_speed ? Number(s.preferred_voice_speed) : null,
  });

  let sources = "";
  try {
    const passages = await retrieveGuruContext(db as never, {
      query: `${ctx.topic} ${ctx.subject ?? ""}`.trim(),
      topicId: ctx.scope === "school" ? ctx.refId ?? null : null,
      limit: 4,
    });
    sources = formatSources(passages);
  } catch {
    sources = "";
  }

  return {
    config,
    teacher,
    language,
    level: Math.max(1, Math.min(5, Number(s?.level ?? 3) > 5 ? 3 : Number(s?.level ?? 3))),
    styleDirective: teachingStyleDirective((s?.preferred_teaching_style as string) ?? teacher.teachingStyle),
    sources,
    toolkit: config?.tools.length ? config.tools.join(", ") : toolkitFor(ctx.subject, ctx.topic),
    premium: config?.access === "premium",
  };
}

const BOARD_SCHEMA = [
  "Board blocks (use 3-6 per turn, mix types where useful):",
  '{"type":"heading","text":"..."}',
  '{"type":"text","text":"...","highlight":true|false}',
  '{"type":"formula","text":"a^2 + b^2 = c^2","label":"Pythagoras"}',
  '{"type":"steps","title":"Solution","items":["step 1","step 2"]}',
  '{"type":"example","title":"Example","body":"..."}',
  '{"type":"code","language":"python","code":"..."}',
  '{"type":"table","columns":["A","B"],"rows":[["1","2"]]}',
  '{"type":"diagram","caption":"Water cycle","nodes":["Evaporation","Condensation","Rain"],"arrows":true}',
].join("\n");

export function buildEnginePrompt(args: {
  ctx: TeachContextInput;
  resolved: ResolvedTeachingContext;
  mode: TeachMode;
  level: number;
}) {
  const { resolved: r, ctx } = args;
  const t = r.teacher;
  return [
    `You are ${t.name}, a 2D animated AI teacher standing at an interactive digital board inside Guru.AI.`,
    t.personality ? `Personality: ${t.personality}.` : "",
    t.tone ? `Tone: ${t.tone}.` : "",
    t.specialization ? `You specialise in ${t.specialization}.` : "",
    r.styleDirective,
    r.language === "hi" ? "Speak and write the board in simple Hindi (Devanagari)." : "Speak and write the board in simple English.",
    [ctx.levelLabel, r.config?.difficulty].filter(Boolean).length
      ? `Student level: ${[ctx.levelLabel, r.config?.difficulty].filter(Boolean).join(" • ")}. Never teach above or below this level.`
      : "",
    `Internal difficulty dial: ${args.level} of 5.`,
    ctx.subject ? `Subject: ${ctx.subject}.` : "",
    `Preferred board tools for this subject: ${r.toolkit}.`,
    r.config?.lesson_structure.length ? `Follow this admin-defined lesson structure: ${r.config.lesson_structure.join(" → ")}.` : "",
    r.config?.teaching_mode ? `Teaching mode: ${r.config.teaching_mode}.` : "",
    r.config?.extra_instructions ? `Admin instructions: ${r.config.extra_instructions}` : "",
    ctx.material ? `Reference material from this lesson:\n${ctx.material.slice(0, 3000)}` : "",
    r.sources
      ? `Authorized study material retrieved from the Guru.AI knowledge library. Prefer it over your own memory and cite it naturally. Never reproduce long verbatim passages.\n\n${r.sources}`
      : "",
    `Task for this turn: ${MODE_BRIEF[args.mode]}`,
    "You fully control the board. Return STRICT JSON only:",
    '{"title":"short lesson title","speech":"what you say aloud","board":[block,...],"question":{"prompt":"...","hint":"...","expected":"ideal answer"}|null,"stepLabel":"e.g. Step 2 of 5","done":false}',
    BOARD_SCHEMA,
    "speech: 60-140 words of natural spoken classroom language. No markdown, no emojis, no asterisks.",
    "Never repeat the exact wording of your previous turns. Never invent facts; say so if unsure.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type TeachTurn = {
  title: string;
  speech: string;
  board: ReturnType<typeof normalizeBoardBlocks>;
  question: { prompt: string; hint: string | null; expected: string | null } | null;
  stepLabel: string | null;
  done: boolean;
};

/** Run one teaching turn through the engine. */
export async function runTeachTurn(args: {
  ctx: TeachContextInput;
  resolved: ResolvedTeachingContext;
  mode: TeachMode;
  level: number;
  studentText?: string | null;
  history?: Array<{ role: "teacher" | "student"; content: string }>;
}): Promise<TeachTurn> {
  const transcript = (args.history ?? [])
    .map((m) => `${m.role === "teacher" ? "Teacher" : "Student"}: ${m.content}`)
    .join("\n")
    .slice(-3000);

  const raw = await callAiChat(
    [
      { role: "system", content: buildEnginePrompt(args) },
      {
        role: "user",
        content: [
          `Topic: ${args.ctx.topic}`,
          transcript ? `Lesson so far:\n${transcript}` : "",
          args.studentText ? `Student says: ${args.studentText}` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    { temperature: 0.6, model: "google/gemini-3.7-flash", responseFormat: "json_object" },
  );

  const p = (extractJson(raw) ?? {}) as Record<string, unknown>;
  const board = normalizeBoardBlocks(p.board);
  const q = p.question && typeof p.question === "object" ? (p.question as Record<string, unknown>) : null;
  const prompt = q ? String(q.prompt ?? "").trim() : "";
  const speech = String(p.speech ?? "").slice(0, 1800);

  return {
    title: String(p.title ?? args.ctx.topic).slice(0, 90),
    speech,
    board: board.length ? board : normalizeBoardBlocks([{ type: "text", text: speech.slice(0, 300) || args.ctx.topic }]),
    question: prompt
      ? {
          prompt: prompt.slice(0, 400),
          hint: q?.hint ? String(q.hint).slice(0, 240) : null,
          expected: q?.expected ? String(q.expected).slice(0, 400) : null,
        }
      : null,
    stepLabel: p.stepLabel ? String(p.stepLabel).slice(0, 40) : null,
    done: p.done === true,
  };
}
