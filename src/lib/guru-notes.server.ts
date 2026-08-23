import { callAiChat, extractJson } from "@/lib/ai-gateway.server";
import type { NotesPayload, QuizItem } from "@/lib/guru-notes";

type Scope = { board: string; className: string; subject: string; language: "en" | "hi" };

function langLine(language: "en" | "hi") {
  return language === "hi"
    ? "Reply in simple Hindi (Devanagari) with English technical terms kept in brackets."
    : "Reply in simple, clear English suitable for a school student.";
}

function scopeLine(s: Scope) {
  return `Board: ${s.board}. Class: ${s.className}. Subject: ${s.subject}.`;
}

function asArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => (x as string).trim()).filter(Boolean) : [];
}

function pairs(v: unknown, a: string, b: string) {
  return Array.isArray(v)
    ? (v as Record<string, unknown>[])
        .map((x) => ({ [a]: String(x?.[a] ?? "").trim(), [b]: String(x?.[b] ?? "").trim() }))
        .filter((x) => x[a] && x[b])
    : [];
}

/** Syllabus chapter list for a board/class/subject. */
export async function suggestChapterList(s: Scope): Promise<string[]> {
  const raw = await callAiChat(
    [
      {
        role: "system",
        content:
          "You are a school syllabus expert for Indian education boards. Return ONLY JSON: {\"chapters\":[\"...\"]} with 8-16 real chapter names in official syllabus order.",
      },
      { role: "user", content: `${scopeLine(s)} List the chapters of the current syllabus. ${langLine(s.language)}` },
    ],
    { responseFormat: "json_object", temperature: 0.2 },
  );
  const parsed = extractJson(raw) as { chapters?: unknown } | null;
  return asArray(parsed?.chapters).slice(0, 16);
}

/** Topics inside one chapter. */
export async function suggestTopicList(s: Scope & { chapter: string }): Promise<string[]> {
  const raw = await callAiChat(
    [
      {
        role: "system",
        content:
          "You are a school syllabus expert for Indian education boards. Return ONLY JSON: {\"topics\":[\"...\"]} with 4-10 teachable topic names covering the chapter in teaching order.",
      },
      {
        role: "user",
        content: `${scopeLine(s)} Chapter: "${s.chapter}". List its topics. ${langLine(s.language)}`,
      },
    ],
    { responseFormat: "json_object", temperature: 0.25 },
  );
  const parsed = extractJson(raw) as { topics?: unknown } | null;
  const list = asArray(parsed?.topics).slice(0, 10);
  return list.length ? list : [s.chapter];
}

/** Full notes for one topic, structured for a colourful UI. */
export async function buildClassNotes(s: Scope & { topic: string }): Promise<NotesPayload> {
  const raw = await callAiChat(
    [
      {
        role: "system",
        content:
          "You are Guru.AI, a warm, expert school teacher. Write exam-ready class notes. Return ONLY JSON with keys: " +
          "title (string), intro (2-3 sentences), simple (3-4 sentences explaining the topic in the simplest possible words, like to a small child, with one everyday analogy), " +
          "keyPoints (5-8 short strings), importantPoints (4-8 must-remember strings for exams), " +
          "sections (4-7 items of {heading, body} where body is 3-6 sentences of clear teaching), " +
          "formulas (0-8 strings; may be empty for non-numeric subjects), examples (2-4 items of {question, solution} with step-by-step solutions), " +
          "practice (4-6 items of {question, answer} practice questions with short worked answers), " +
          "revision (5-8 very short one-line revision bullets), examTips (3-5 strings), nextTopics (3-5 related topic names). " +
          "Never invent facts outside the syllabus level.",
      },
      {
        role: "user",
        content: `${scopeLine(s)} Topic: "${s.topic}". Teach this topic completely as class notes. ${langLine(s.language)}`,
      },
    ],
    { responseFormat: "json_object", temperature: 0.4 },
  );
  const p = (extractJson(raw) ?? {}) as Record<string, unknown>;
  return {
    title: String(p.title ?? s.topic),
    intro: String(p.intro ?? ""),
    simple: String(p.simple ?? ""),
    keyPoints: asArray(p.keyPoints).slice(0, 8),
    importantPoints: asArray(p.importantPoints).slice(0, 8),
    sections: pairs(p.sections, "heading", "body").slice(0, 7) as { heading: string; body: string }[],
    formulas: asArray(p.formulas).slice(0, 8),
    examples: pairs(p.examples, "question", "solution").slice(0, 4) as { question: string; solution: string }[],
    practice: pairs(p.practice, "question", "answer").slice(0, 6) as { question: string; answer: string }[],
    revision: asArray(p.revision).slice(0, 8),
    examTips: asArray(p.examTips).slice(0, 5),
    nextTopics: asArray(p.nextTopics).slice(0, 5),
  };
}

/** A short MCQ quiz for the topic. */
export async function buildTopicQuiz(s: Scope & { topic: string }): Promise<QuizItem[]> {
  const raw = await callAiChat(
    [
      {
        role: "system",
        content:
          "You write school MCQ quizzes. Return ONLY JSON: {\"questions\":[{\"question\":\"...\",\"options\":[\"a\",\"b\",\"c\",\"d\"],\"answerIndex\":0,\"explanation\":\"...\"}]} " +
          "with exactly 5 questions, 4 options each, answerIndex 0-3, one-line explanations.",
      },
      {
        role: "user",
        content: `${scopeLine(s)} Topic: "${s.topic}". Create the quiz at the right difficulty for this class. ${langLine(s.language)}`,
      },
    ],
    { responseFormat: "json_object", temperature: 0.5 },
  );
  const parsed = (extractJson(raw) ?? {}) as { questions?: unknown };
  const rows = Array.isArray(parsed.questions) ? (parsed.questions as Record<string, unknown>[]) : [];
  return rows
    .map((q) => {
      const options = asArray(q.options).slice(0, 4);
      const idx = Number(q.answerIndex ?? 0);
      return {
        question: String(q.question ?? "").trim(),
        options,
        answerIndex: Number.isFinite(idx) && idx >= 0 && idx < options.length ? idx : 0,
        explanation: String(q.explanation ?? "").trim(),
      };
    })
    .filter((q) => q.question && q.options.length === 4)
    .slice(0, 5);
}

/** Conversational doubt answering grounded in the selected notes topic. */
export async function answerNotesDoubt(
  s: Scope & { topic: string; question: string; history: { role: "user" | "assistant"; content: string }[] },
): Promise<{ answer: string }> {
  const answer = await callAiChat(
    [
      {
        role: "system",
        content:
          `You are Guru.AI, a patient class teacher. ${scopeLine(s)} Current topic: "${s.topic}". ` +
          `Answer the student's doubt step by step with a tiny example, then one line of encouragement. Keep it under 220 words. Use plain text with short bullet lines (no markdown tables). ${langLine(s.language)}`,
      },
      ...s.history.map((m) => ({ role: m.role, content: m.content }) as const),
      { role: "user" as const, content: s.question },
    ],
    { temperature: 0.5 },
  );
  return { answer: answer.trim() };
}
