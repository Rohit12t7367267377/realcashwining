import { callAiChat, extractJson } from "@/lib/ai-gateway.server";

export type ExamQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  topic: string;
};

export type ExamSyllabus = {
  overview: string;
  pattern: { label: string; value: string }[];
  units: { subject: string; items: string[] }[];
  tips: string[];
};

export type StudyPlan = {
  summary: string;
  weeks: { week: string; focus: string; tasks: string[] }[];
  daily: string[];
};

const str = (v: unknown) => String(v ?? "").trim();
const arr = (v: unknown) =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => (x as string).trim()).filter(Boolean) : [];

function langLine(language: "en" | "hi") {
  return language === "hi"
    ? "Reply in simple Hindi (Devanagari), keeping technical terms in English brackets."
    : "Reply in clear, exam-oriented English.";
}

/** Official-style syllabus + paper pattern for a competitive exam. */
export async function buildExamSyllabus(exam: string, language: "en" | "hi"): Promise<ExamSyllabus> {
  const raw = await callAiChat(
    [
      {
        role: "system",
        content:
          "You are an Indian competitive-exam syllabus expert. Return ONLY JSON with keys: " +
          'overview (3-4 sentences), pattern (4-8 items of {label,value} such as Mode, Duration, Total questions, Marking scheme), ' +
          'units (3-8 items of {subject, items:[8-14 syllabus topic strings]}), tips (4-6 strings). ' +
          "Use the latest publicly announced syllabus. Never invent question papers.",
      },
      { role: "user", content: `Exam: ${exam}. Give the syllabus and paper pattern. ${langLine(language)}` },
    ],
    { responseFormat: "json_object", temperature: 0.25 },
  );
  const p = (extractJson(raw) ?? {}) as Record<string, unknown>;
  const pattern = Array.isArray(p.pattern)
    ? (p.pattern as Record<string, unknown>[])
        .map((x) => ({ label: str(x.label), value: str(x.value) }))
        .filter((x) => x.label && x.value)
        .slice(0, 8)
    : [];
  const units = Array.isArray(p.units)
    ? (p.units as Record<string, unknown>[])
        .map((x) => ({ subject: str(x.subject), items: arr(x.items).slice(0, 14) }))
        .filter((x) => x.subject && x.items.length)
        .slice(0, 8)
    : [];
  return { overview: str(p.overview), pattern, units, tips: arr(p.tips).slice(0, 6) };
}

/** Topic list for one exam subject (used when the admin has not added topics yet). */
export async function buildExamTopics(exam: string, subject: string): Promise<string[]> {
  const raw = await callAiChat(
    [
      {
        role: "system",
        content:
          'You are an Indian competitive-exam syllabus expert. Return ONLY JSON: {"topics":["..."]} with 10-18 real syllabus topics in teaching order.',
      },
      { role: "user", content: `Exam: ${exam}. Subject: ${subject}. List the syllabus topics.` },
    ],
    { responseFormat: "json_object", temperature: 0.2 },
  );
  const p = (extractJson(raw) ?? {}) as { topics?: unknown };
  return arr(p.topics).slice(0, 18);
}

/**
 * Question set for practice, quiz, mock test or previous-year style revision.
 * PYQ mode asks for questions modelled on publicly released past papers — never
 * verbatim copyrighted text.
 */
export async function buildExamQuestions(input: {
  exam: string;
  subject: string;
  topic?: string;
  mode: "practice" | "quiz" | "mock" | "pyq";
  count: number;
  difficulty: "easy" | "medium" | "hard";
  language: "en" | "hi";
}): Promise<ExamQuestion[]> {
  const modeLine =
    input.mode === "pyq"
      ? "Build questions modelled on publicly released previous-year papers of this exam. Do NOT reproduce copyrighted question text verbatim — rewrite in your own words and mention the likely year in the explanation when known."
      : input.mode === "mock"
        ? "Build a balanced mock-test section that mirrors the real paper's difficulty spread and question styles."
        : input.mode === "quiz"
          ? "Build a quick revision quiz."
          : "Build focused practice questions that build the concept step by step.";
  const raw = await callAiChat(
    [
      {
        role: "system",
        content:
          "You set questions for Indian competitive exams. Return ONLY JSON: " +
          '{"questions":[{"question":"...","options":["a","b","c","d"],"answerIndex":0,"explanation":"...","topic":"..."}]} ' +
          `with exactly ${input.count} questions, 4 options each, answerIndex 0-3 and a 1-3 line solution in explanation. ${modeLine}`,
      },
      {
        role: "user",
        content:
          `Exam: ${input.exam}. Subject: ${input.subject}. ${input.topic ? `Topic: ${input.topic}.` : "Cover the whole subject syllabus."} ` +
          `Difficulty: ${input.difficulty}. ${langLine(input.language)}`,
      },
    ],
    { responseFormat: "json_object", temperature: input.mode === "practice" ? 0.4 : 0.55 },
  );
  const p = (extractJson(raw) ?? {}) as { questions?: unknown };
  const rows = Array.isArray(p.questions) ? (p.questions as Record<string, unknown>[]) : [];
  return rows
    .map((q) => {
      const options = arr(q.options).slice(0, 4);
      const idx = Number(q.answerIndex ?? 0);
      return {
        question: str(q.question),
        options,
        answerIndex: Number.isFinite(idx) && idx >= 0 && idx < options.length ? idx : 0,
        explanation: str(q.explanation),
        topic: str(q.topic) || input.topic || input.subject,
      };
    })
    .filter((q) => q.question && q.options.length === 4)
    .slice(0, input.count);
}

/** Personalised study plan built from the learner's weak topics. */
export async function buildStudyPlan(input: {
  exam: string;
  weeks: number;
  hoursPerDay: number;
  weakTopics: string[];
  language: "en" | "hi";
}): Promise<StudyPlan> {
  const raw = await callAiChat(
    [
      {
        role: "system",
        content:
          "You are a competitive-exam mentor. Return ONLY JSON with keys: summary (2-3 sentences), " +
          'weeks (items of {week, focus, tasks:[3-5 strings]}), daily (4-6 strings describing a daily routine).',
      },
      {
        role: "user",
        content:
          `Exam: ${input.exam}. Build a ${input.weeks}-week plan at ${input.hoursPerDay} hours per day. ` +
          `${input.weakTopics.length ? `Weak areas to prioritise: ${input.weakTopics.join(", ")}.` : "The learner is starting fresh."} ${langLine(input.language)}`,
      },
    ],
    { responseFormat: "json_object", temperature: 0.4 },
  );
  const p = (extractJson(raw) ?? {}) as Record<string, unknown>;
  const weeks = Array.isArray(p.weeks)
    ? (p.weeks as Record<string, unknown>[])
        .map((x) => ({ week: str(x.week), focus: str(x.focus), tasks: arr(x.tasks).slice(0, 5) }))
        .filter((x) => x.week || x.focus)
        .slice(0, 24)
    : [];
  return { summary: str(p.summary), weeks, daily: arr(p.daily).slice(0, 6) };
}
