import { callAiChat, extractJson } from "@/lib/ai-gateway.server";
import type { NotesPayload } from "@/lib/guru-notes";

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

/** Full notes for one topic, structured for a colourful UI. */
export async function buildClassNotes(s: Scope & { topic: string }): Promise<NotesPayload> {
  const raw = await callAiChat(
    [
      {
        role: "system",
        content:
          "You are Guru.AI, a warm, expert school teacher. Write exam-ready class notes. Return ONLY JSON with keys: " +
          "title (string), intro (2-3 sentences), keyPoints (5-8 short strings), sections (4-7 items of {heading, body} where body is 3-6 sentences of clear teaching), " +
          "formulas (0-8 strings; may be empty for non-numeric subjects), examples (2-4 items of {question, solution} with step-by-step solutions), " +
          "examTips (3-5 strings), nextTopics (3-5 related topic names). Never invent facts outside the syllabus level.",
      },
      {
        role: "user",
        content: `${scopeLine(s)} Topic: "${s.topic}". Teach this topic completely as class notes. ${langLine(s.language)}`,
      },
    ],
    { responseFormat: "json_object", temperature: 0.4 },
  );
  const p = (extractJson(raw) ?? {}) as Record<string, unknown>;
  const sections = Array.isArray(p.sections)
    ? (p.sections as Record<string, unknown>[])
        .map((x) => ({ heading: String(x?.heading ?? "").trim(), body: String(x?.body ?? "").trim() }))
        .filter((x) => x.heading && x.body)
    : [];
  const examples = Array.isArray(p.examples)
    ? (p.examples as Record<string, unknown>[])
        .map((x) => ({ question: String(x?.question ?? "").trim(), solution: String(x?.solution ?? "").trim() }))
        .filter((x) => x.question && x.solution)
    : [];
  return {
    title: String(p.title ?? s.topic),
    intro: String(p.intro ?? ""),
    keyPoints: asArray(p.keyPoints).slice(0, 8),
    sections: sections.slice(0, 7),
    formulas: asArray(p.formulas).slice(0, 8),
    examples: examples.slice(0, 4),
    examTips: asArray(p.examTips).slice(0, 5),
    nextTopics: asArray(p.nextTopics).slice(0, 5),
  };
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
